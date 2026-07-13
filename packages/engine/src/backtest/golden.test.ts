import { promises as fs } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { createEarningsDriftAnalyst } from "../analysts/quant/earnings-drift.js"
import { createValueAnalyst } from "../analysts/personas/value.js"
import { FIXTURE_IDS, loadFixtureDataset } from "../data/fixture/dataset.js"
import { MemoryResponseStore } from "../data/response-store.js"
import { FakeLlmClient, toolResult } from "../llm/fake.js"
import { PromptCache } from "../llm/prompt-cache.js"
import type { BacktestResult } from "./engine.js"
import { runFixtureBacktest } from "./fixture-backtest.js"

/**
 * Golden-file backtests (plan 002 phase 3): a full run over the committed
 * synthetic fixtures whose metrics are **byte-identical across runs** and locked
 * to a committed JSON. The first scenario runs the earnings-drift quant; the
 * second runs the value persona with a scripted {@link FakeLlmClient}.
 *
 * Set `UPDATE_GOLDEN=1` to regenerate the committed files after an intended
 * behaviour change.
 */

const UPDATE = process.env.UPDATE_GOLDEN === "1"

function round(value: number, dp = 8): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

/** A compact, platform-stable snapshot of a result for golden comparison. */
function snapshotOf(result: BacktestResult): unknown {
  const equities = result.equityCurve.map((p) => p.equity)
  return {
    baseCurrency: result.baseCurrency,
    caveats: result.caveats,
    equityCurve: {
      length: result.equityCurve.length,
      first: round(equities[0] ?? 0, 4),
      last: round(equities[equities.length - 1] ?? 0, 4),
      sum: round(
        equities.reduce((s, e) => s + e, 0),
        4,
      ),
    },
    metrics: Object.fromEntries(
      Object.entries(result.metrics).map(([k, v]) => [k, typeof v === "number" ? round(v) : v]),
    ),
    trades: {
      count: result.trades.length,
      byCurrency: countBy(result.trades.map((t) => t.fill.currency)),
      bySide: countBy(result.trades.map((t) => t.fill.side)),
      first: summarizeTrade(result, 0),
      last: summarizeTrade(result, result.trades.length - 1),
    },
    corporateActions: result.corporateActions.map((c) => ({
      type: c.type,
      exDate: c.exDate,
      before: c.split?.before,
      after: c.split?.after,
      cashCredited: c.dividend?.cashCredited,
    })),
  }
}

function countBy(values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of values) out[v] = (out[v] ?? 0) + 1
  return out
}

function summarizeTrade(result: BacktestResult, index: number): unknown {
  const trade = result.trades[index]
  if (!trade) return null
  return {
    securityId: trade.fill.securityId,
    side: trade.fill.side,
    quantity: trade.fill.quantity,
    price: round(trade.fill.price, 6),
    currency: trade.fill.currency,
    filledAt: trade.fill.filledAt,
    conviction: round(trade.signal.conviction, 8),
    abstained: trade.signal.abstained,
  }
}

async function assertGolden(name: string, snapshot: unknown): Promise<void> {
  const url = new URL(`./__golden__/${name}.golden.json`, import.meta.url)
  const path = fileURLToPath(url)
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`
  if (UPDATE) {
    await fs.mkdir(fileURLToPath(new URL("./__golden__/", import.meta.url)), { recursive: true })
    await fs.writeFile(path, serialized, "utf8")
    return
  }
  const committed = await fs.readFile(path, "utf8")
  expect(serialized).toBe(committed)
}

describe("golden backtest — earnings-drift quant", () => {
  it("is deterministic and matches the committed golden", async () => {
    const dataset = await loadFixtureDataset()
    const run = () =>
      runFixtureBacktest(dataset, {
        analyst: createEarningsDriftAnalyst(),
        initialCash: { USD: 1_000_000 },
      })

    const [a, b] = await Promise.all([run(), run()])
    // Byte-identical determinism across independent runs.
    expect(JSON.stringify(snapshotOf(a))).toBe(JSON.stringify(snapshotOf(b)))
    expect(a.trades.length).toBeGreaterThan(0)

    await assertGolden("earnings-drift", snapshotOf(a))
  })
})

describe("golden backtest — value persona (scripted LLM)", () => {
  it("is deterministic and matches the committed golden", async () => {
    const dataset = await loadFixtureDataset()
    // Bullish on the two large caps (exercises USD + cross-currency NOK buys),
    // neutral on the micro-cap.
    const script = (prompt: string) =>
      prompt.includes(FIXTURE_IDS.osloMicroCap)
        ? toolResult({ signal: "neutral", confidence: 0, reasoning: "no edge" })
        : toolResult({ signal: "bullish", confidence: 70, reasoning: "cheap vs owner earnings" })

    const run = () => {
      const llm = new FakeLlmClient((req) => script(req.prompt))
      const cache = new PromptCache(new MemoryResponseStore())
      return runFixtureBacktest(dataset, {
        analyst: createValueAnalyst({ llm, cache, model: "golden-model", now: () => "2020-01-01T00:00:00.000Z" }),
        initialCash: { USD: 1_000_000 },
      })
    }

    const [a, b] = await Promise.all([run(), run()])
    expect(JSON.stringify(snapshotOf(a))).toBe(JSON.stringify(snapshotOf(b)))
    expect(a.trades.length).toBeGreaterThan(0)
    // The bullish NOK name must have traded — proving the cross-currency path ran.
    expect(a.trades.some((t) => t.fill.currency === "NOK")).toBe(true)

    await assertGolden("value-persona", snapshotOf(a))
  })
})
