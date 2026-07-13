import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * Append-only, revision-aware response store (plan 003).
 *
 * Providers restate fundamentals, backfill earnings, and correct adjustment
 * factors, so "historical = immutable" is false at the provider layer. Each
 * stored response carries an `observedAt` and a `revision` counter; a re-fetch
 * whose payload DIFFERS appends a new revision (never overwrites), and reads
 * default to the latest revision. This is deliberately not a naive cache: a
 * full bitemporal store is deferred, but because revisions are kept from day
 * one, nothing is lost.
 *
 * The `key` is `hash(provider + method + params)`; only successful responses
 * are stored, so an outage can never be laundered into "no data" by a cache hit.
 */

export interface StoredResponse {
  readonly key: string
  readonly revision: number
  readonly observedAt: string
  readonly contentHash: string
  readonly payload: unknown
}

export interface ResponseStore {
  /** Latest revision for `key`, or null if never stored. */
  read(key: string): Promise<StoredResponse | null>
  /** All revisions for `key`, oldest first. */
  revisions(key: string): Promise<StoredResponse[]>
  /**
   * Store `payload`. If it is byte-identical to the latest revision, no new
   * revision is written and the existing latest is returned. Otherwise a new
   * revision is appended and returned.
   */
  append(key: string, payload: unknown, observedAt?: string): Promise<StoredResponse>
}

/** Stable stringify (sorted keys) so hashing is order-independent. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value))
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]))
  }
  return value
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex")
}

function keyFilename(key: string): string {
  return `${createHash("sha256").update(key).digest("hex")}.json`
}

/**
 * File-backed {@link ResponseStore}: one JSON file per key holding the ordered
 * revision list. No Postgres dependency (that lands with `packages/db` behind
 * this same interface in phase 5).
 */
export class FileResponseStore implements ResponseStore {
  constructor(private readonly baseDir: string) {}

  private fileFor(key: string): string {
    return path.join(this.baseDir, keyFilename(key))
  }

  async revisions(key: string): Promise<StoredResponse[]> {
    try {
      const raw = await fs.readFile(this.fileFor(key), "utf8")
      return JSON.parse(raw) as StoredResponse[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
      throw err
    }
  }

  async read(key: string): Promise<StoredResponse | null> {
    const revs = await this.revisions(key)
    return revs.length > 0 ? (revs[revs.length - 1] ?? null) : null
  }

  async append(
    key: string,
    payload: unknown,
    observedAt: string = new Date().toISOString(),
  ): Promise<StoredResponse> {
    const revs = await this.revisions(key)
    const contentHash = hashPayload(payload)
    const latest = revs[revs.length - 1]
    if (latest && latest.contentHash === contentHash) {
      return latest
    }
    const next: StoredResponse = {
      key,
      revision: (latest?.revision ?? 0) + 1,
      observedAt,
      contentHash,
      payload,
    }
    revs.push(next)
    await fs.mkdir(this.baseDir, { recursive: true })
    await fs.writeFile(this.fileFor(key), JSON.stringify(revs, null, 2), "utf8")
    return next
  }
}

/** In-memory {@link ResponseStore} — handy for per-run memoization and tests. */
export class MemoryResponseStore implements ResponseStore {
  private readonly store = new Map<string, StoredResponse[]>()

  async revisions(key: string): Promise<StoredResponse[]> {
    return [...(this.store.get(key) ?? [])]
  }

  async read(key: string): Promise<StoredResponse | null> {
    const revs = this.store.get(key)
    return revs && revs.length > 0 ? (revs[revs.length - 1] ?? null) : null
  }

  async append(
    key: string,
    payload: unknown,
    observedAt: string = new Date().toISOString(),
  ): Promise<StoredResponse> {
    const revs = this.store.get(key) ?? []
    const contentHash = hashPayload(payload)
    const latest = revs[revs.length - 1]
    if (latest && latest.contentHash === contentHash) {
      return latest
    }
    const next: StoredResponse = {
      key,
      revision: (latest?.revision ?? 0) + 1,
      observedAt,
      contentHash,
      payload,
    }
    revs.push(next)
    this.store.set(key, revs)
    return next
  }
}
