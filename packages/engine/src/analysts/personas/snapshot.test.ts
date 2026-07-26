import { describe, expect, it } from "vitest"

import type { FundamentalsSnapshot } from "../../data/types.js"
import { renderFundamentalsContext, type RenderFundamentalsInput } from "./snapshot.js"

function snap(
  fiscalPeriod: string,
  metrics: FundamentalsSnapshot["metrics"],
): FundamentalsSnapshot {
  return { securityId: "US-XNAS-SYNA", fiscalPeriod, knownAt: `${fiscalPeriod}-12-31`, currency: "USD", metrics }
}

const INPUT: RenderFundamentalsInput = {
  securityId: "US-XNAS-SYNA",
  currency: "USD",
  price: 10,
  periodsPerYear: 1,
  snapshots: [
    snap("2018", {
      revenue: 1000,
      netIncome: 100,
      totalEquity: 500,
      totalDebt: 200,
      sharesOutstanding: 100,
      operatingCashFlow: 150,
      capitalExpenditure: 50,
    }),
    snap("2019", {
      revenue: 1100,
      netIncome: 121,
      totalEquity: 550,
      totalDebt: 210,
      sharesOutstanding: 100,
      operatingCashFlow: 165,
      capitalExpenditure: 55,
    }),
    snap("2020", {
      revenue: 1210,
      netIncome: 145.2,
      totalEquity: 605,
      totalDebt: 220,
      sharesOutstanding: 100,
      operatingCashFlow: 181.5,
      capitalExpenditure: 60.5,
    }),
  ],
}

describe("renderFundamentalsContext", () => {
  it("renders a deterministic context table (golden file)", async () => {
    const rendered = renderFundamentalsContext(INPUT)
    await expect(rendered.text).toMatchFileSnapshot("./__snapshots__/value-context.golden.txt")
  })

  it("hashes the rendered context deterministically", () => {
    const a = renderFundamentalsContext(INPUT)
    const b = renderFundamentalsContext(INPUT)
    expect(a.contentHash).toBe(b.contentHash)
    expect(a.contentHash).toMatchInlineSnapshot(`"92a92647bf3d81ffc890006aab8b3db18ac03beda3daef77a786410f01d214ad"`)
  })

  it("changes the hash when an input changes", () => {
    const base = renderFundamentalsContext(INPUT).contentHash
    const moved = renderFundamentalsContext({ ...INPUT, price: 11 }).contentHash
    expect(moved).not.toBe(base)
  })
})
