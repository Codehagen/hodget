/**
 * Tiny shared framework for the plan-003 phase-0 provider spike.
 *
 * A spike tool, NOT engine code — deliberately plain, zero new dependencies
 * (native `fetch` + `node:fs`), and never wired into `src/` or the public
 * barrel. It runs a list of provider "checks", records every raw HTTP payload
 * as a gitignored cassette, and returns structured results the findings
 * renderer turns into a note for plan 003.
 *
 * Politeness to the live APIs is built in here so no individual check can
 * forget it: requests are globally serialized with a ~300ms gap, and transport
 * failures are caught and surfaced as results — a single bad request never
 * crashes the whole run.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export type ProviderId = "financial-datasets" | "eodhd"

/** What a check needs before it is allowed to touch the network. */
export type Requirement = "fd-key" | "eodhd-key" | "eodhd-demo" | "none"

export type ResultStatus = "pass" | "fail" | "warn"
export type CheckStatus = ResultStatus | "skipped"

export interface CheckResult {
  readonly status: ResultStatus
  readonly detail: string
  /** Small JSON excerpt shown in findings.md — keep it a handful of numbers. */
  readonly evidence?: unknown
}

export interface HttpResult {
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  /** Request URL with any API key redacted — safe to persist and print. */
  readonly url: string
  readonly headers: Record<string, string>
  /** Parsed JSON body when the response was JSON; otherwise `undefined`. */
  readonly json?: unknown
  /** Raw text body (always captured, used for error snippets). */
  readonly text: string
  /** Populated when the request never completed (DNS/timeout/reset/etc.). */
  readonly networkError?: string
}

export interface CheckContext {
  readonly provider: ProviderId
  /**
   * GET `path` (relative to the provider base) with the provider's auth
   * applied automatically. Every call is rate-limited, and its payload is
   * saved as a cassette. Never throws — inspect `.ok` / `.networkError`.
   */
  get(path: string, query?: Record<string, string | number>): Promise<HttpResult>
}

export interface Check {
  readonly id: string
  readonly title: string
  readonly provider: ProviderId
  readonly requires: Requirement
  run(ctx: CheckContext): Promise<CheckResult>
}

export interface RunOptions {
  /** Financial Datasets key, or `null` when absent. */
  readonly fdKey: string | null
  /** Resolved EODHD token — a real key when supplied, otherwise `"demo"`. */
  readonly eodhdToken: string
  /** True only when a real EODHD key was supplied (not the demo fallback). */
  readonly eodhdRealKey: boolean
  /** Absolute path to `spike/output`. */
  readonly outputDir: string
  readonly delayMs?: number
}

export interface RunResult {
  readonly check: Check
  readonly status: CheckStatus
  readonly detail: string
  readonly evidence?: unknown
}

const PROVIDER_BASE: Record<ProviderId, string> = {
  "financial-datasets": "https://api.financialdatasets.ai",
  eodhd: "https://eodhd.com/api",
}

// Global serialization gate: one in-flight request at a time, >= delayMs apart.
let lastFetchAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function satisfied(req: Requirement, opts: RunOptions): boolean {
  switch (req) {
    case "none":
      return true
    case "eodhd-demo":
      return true
    case "eodhd-key":
      return opts.eodhdRealKey
    case "fd-key":
      return opts.fdKey !== null
  }
}

function skipReason(req: Requirement): string {
  switch (req) {
    case "fd-key":
      return "skipped — FINANCIAL_DATASETS_API_KEY not set"
    case "eodhd-key":
      return "skipped — no real EODHD_API_TOKEN (demo tier cannot reach this data)"
    case "eodhd-demo":
    case "none":
      return "skipped"
  }
}

/** Clone a URL with any API key query param blanked, for safe persistence. */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.searchParams.has("api_token")) url.searchParams.set("api_token", "REDACTED")
    return url.toString()
  } catch {
    return raw
  }
}

function applyAuth(provider: ProviderId, url: URL, headers: Headers, opts: RunOptions): void {
  if (provider === "financial-datasets") {
    headers.set("X-API-KEY", opts.fdKey ?? "")
    return
  }
  url.searchParams.set("api_token", opts.eodhdToken)
  if (!url.searchParams.has("fmt")) url.searchParams.set("fmt", "json")
}

async function performGet(
  provider: ProviderId,
  path: string,
  query: Record<string, string | number> | undefined,
  opts: RunOptions,
  delayMs: number,
): Promise<HttpResult> {
  const url = new URL(PROVIDER_BASE[provider] + path)
  if (query) {
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))
  }
  const headers = new Headers()
  applyAuth(provider, url, headers, opts)

  const wait = delayMs - (Date.now() - lastFetchAt)
  if (wait > 0) await sleep(wait)

  const safeUrl = redactUrl(url.toString())
  try {
    const res = await fetch(url, { headers })
    lastFetchAt = Date.now()
    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
    const responseHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: safeUrl,
      headers: responseHeaders,
      json,
      text,
    }
  } catch (err) {
    lastFetchAt = Date.now()
    return {
      ok: false,
      status: 0,
      statusText: "",
      url: safeUrl,
      headers: {},
      text: "",
      networkError: err instanceof Error ? err.message : String(err),
    }
  }
}

function saveCassette(
  outputDir: string,
  provider: ProviderId,
  checkId: string,
  n: number,
  res: HttpResult,
): void {
  const file = join(outputDir, "cassettes", `${provider}.${checkId}.${n}.json`)
  const body = res.json ?? res.text
  const payload = {
    url: res.url,
    status: res.status,
    networkError: res.networkError,
    headers: res.headers,
    body,
  }
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

/**
 * Run every check in order. Requirement-gated checks that lack their key are
 * reported `skipped` with no network I/O. Everything else runs against the
 * live provider; a thrown check becomes a `fail` result rather than aborting.
 */
export async function runChecks(checks: readonly Check[], opts: RunOptions): Promise<RunResult[]> {
  const delayMs = opts.delayMs ?? 300
  mkdirSync(join(opts.outputDir, "cassettes"), { recursive: true })

  const results: RunResult[] = []
  for (const check of checks) {
    if (!satisfied(check.requires, opts)) {
      results.push({ check, status: "skipped", detail: skipReason(check.requires) })
      continue
    }

    let counter = 0
    const ctx: CheckContext = {
      provider: check.provider,
      async get(path, query) {
        const res = await performGet(check.provider, path, query, opts, delayMs)
        counter += 1
        saveCassette(opts.outputDir, check.provider, check.id, counter, res)
        return res
      },
    }

    try {
      const result = await check.run(ctx)
      results.push({ check, status: result.status, detail: result.detail, evidence: result.evidence })
    } catch (err) {
      results.push({
        check,
        status: "fail",
        detail: `check threw: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
  return results
}

// --- small helpers shared by check suites ------------------------------------

/** First array-valued property of an object body (or the body itself). */
export function firstArray(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body
  if (body && typeof body === "object") {
    for (const value of Object.values(body)) {
      if (Array.isArray(value)) return value
    }
  }
  return null
}

/** A short, human-readable reason an HTTP result was unusable. */
export function httpFailDetail(res: HttpResult): string {
  if (res.networkError) return `network error: ${res.networkError}`
  const snippet = res.text.slice(0, 200).replace(/\s+/g, " ").trim()
  return `HTTP ${res.status} ${res.statusText || "(no status text)"} — ${snippet || "(empty body)"}`
}

/** Read a property off an unknown record without narrowing gymnastics. */
export function prop(row: unknown, key: string): unknown {
  if (row && typeof row === "object") return (row as Record<string, unknown>)[key]
  return undefined
}

/** Fraction of `rows` for which `key` is present and non-null. */
export function nonNullFraction(rows: readonly unknown[], key: string): number {
  if (rows.length === 0) return 0
  const hits = rows.filter((row) => prop(row, key) != null).length
  return hits / rows.length
}
