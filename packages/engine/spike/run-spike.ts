/**
 * Plan-003 phase-0 provider spike — entry point.
 *
 * Run with:  pnpm --filter @workspace/engine spike
 * (executes under Node's `--experimental-strip-types`; cross-file imports use
 * explicit `.ts` specifiers, which Node requires and which the sibling
 * `spike/tsconfig.json` typechecks via `allowImportingTsExtensions`.)
 *
 * Environment:
 *   FINANCIAL_DATASETS_API_KEY   → enables the `fd-key` checks (all skipped if unset)
 *   EODHD_API_TOKEN              → enables the `eodhd-key` (Oslo) checks
 *                                  Unset ⇒ falls back to the public `demo` token,
 *                                  which only covers the demo symbol set; the
 *                                  `eodhd-key` checks are then skipped while the
 *                                  `eodhd-demo` checks (8–11) still run live.
 *
 * Output (all under spike/output/, gitignored):
 *   cassettes/<provider>.<check-id>.<n>.json   raw payloads
 *   findings.md                                 the note for plan 003
 *
 * This is a spike tool, not engine code: zero new dependencies, never imported
 * by src/ or the public barrel.
 */

import { fileURLToPath } from "node:url"

import { financialDatasetsChecks } from "./checks/financial-datasets.ts"
import { eodhdChecks } from "./checks/eodhd.ts"
import { renderFindings } from "./findings.ts"
import { runChecks, type Check, type RunOptions } from "./harness.ts"
import { writeFileSync } from "node:fs"

const BADGE: Record<string, string> = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
  skipped: "SKIP",
}

async function main(): Promise<void> {
  const fdKey = process.env.FINANCIAL_DATASETS_API_KEY?.trim() || null
  const realEodhd = process.env.EODHD_API_TOKEN?.trim() || null
  const eodhdToken = realEodhd ?? "demo"

  const outputDir = fileURLToPath(new URL("./output", import.meta.url))
  const opts: RunOptions = {
    fdKey,
    eodhdToken,
    eodhdRealKey: realEodhd !== null,
    outputDir,
  }

  console.log("plan-003 provider spike")
  console.log(`  Financial Datasets key: ${fdKey ? "present" : "absent (fd checks skipped)"}`)
  console.log(`  EODHD token: ${realEodhd ? "real key" : "demo (eodhd-key checks skipped)"}`)
  console.log("")

  const checks: readonly Check[] = [...financialDatasetsChecks, ...eodhdChecks]
  const results = await runChecks(checks, opts)

  for (const r of results) {
    console.log(`  [${BADGE[r.status] ?? r.status}] ${r.check.id} — ${r.detail}`)
  }

  const runDate = new Date().toISOString().slice(0, 10)
  const md = renderFindings(results, {
    runDate,
    fdKeyPresent: fdKey !== null,
    eodhdRealKey: realEodhd !== null,
  })
  const findingsPath = fileURLToPath(new URL("./output/findings.md", import.meta.url))
  writeFileSync(findingsPath, md, "utf8")

  const counts = { pass: 0, warn: 0, fail: 0, skipped: 0 }
  for (const r of results) counts[r.status] += 1
  console.log("")
  console.log(
    `  ${counts.pass} pass · ${counts.warn} warn · ${counts.fail} fail · ${counts.skipped} skipped`,
  )
  console.log(`  findings → ${findingsPath}`)
}

main().catch((err: unknown) => {
  console.error("spike crashed:", err)
  process.exitCode = 1
})
