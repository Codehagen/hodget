/**
 * Demo runner: executes the earnings-drift analyst over the committed
 * synthetic fixtures and prints signals, trades, and metrics. Lives under
 * scripts/ so the default vitest run (src/**) never picks it up.
 *
 * Run: pnpm --filter @workspace/engine exec vitest run scripts/demo.test.ts
 */
import { test } from "vitest"

import { createEarningsDriftAnalyst } from "../src/analysts/quant/earnings-drift.js"
import { runFixtureBacktest } from "../src/backtest/fixture-backtest.js"
import { loadFixtureDataset } from "../src/data/fixture/dataset.js"

test("demo: earnings-drift backtest on synthetic fixtures", async () => {
  const dataset = await loadFixtureDataset()

  console.log(`\n=== hodget engine demo — earnings-drift on synthetic fixtures ===\n`)
  console.log(
    `Universe: ${dataset.securities.map((s) => `${s.securityId} (${s.currency})`).join(", ")}`,
  )
  console.log(`Span: ${dataset.meta.from} → ${dataset.meta.to}\n`)

  const result = await runFixtureBacktest(dataset, {
    analyst: createEarningsDriftAnalyst(),
    initialCash: { USD: 1_000_000 },
  })

  console.log(`--- Trades (${result.trades.length}) ---`)
  for (const t of result.trades.slice(0, 12)) {
    const f = t.fill
    console.log(
      `${f.filledAt.slice(0, 10)}  ${f.side.padEnd(4)} ${String(f.quantity).padStart(6)} ${f.securityId}` +
        `  @ ${f.price.toFixed(2)} ${f.currency}` +
        `  (conviction ${t.signal.conviction.toFixed(2)}, ${JSON.stringify(t.signal.components ?? {})})`,
    )
  }
  if (result.trades.length > 12) console.log(`… ${result.trades.length - 12} more`)

  const eq = result.equityCurve
  console.log(`\n--- Equity curve (base USD) ---`)
  console.log(`start  ${eq[0]?.date}: ${eq[0]?.equity.toFixed(0)}`)
  console.log(`end    ${eq[eq.length - 1]?.date}: ${eq[eq.length - 1]?.equity.toFixed(0)}`)

  console.log(`\n--- Metrics ---`)
  for (const [k, v] of Object.entries(result.metrics)) {
    console.log(`${k.padEnd(22)} ${typeof v === "number" ? v.toFixed(4) : v}`)
  }
  console.log(`\nCaveats: ${result.caveats.join(" | ")}\n`)
})
