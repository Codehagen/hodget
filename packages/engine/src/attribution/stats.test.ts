import { describe, expect, it } from "vitest"

import { rank, spearman } from "./stats.js"

describe("rank", () => {
  it("assigns 1-based ordinal ranks aligned to input positions", () => {
    expect(rank([10, 30, 20])).toEqual([1, 3, 2])
  })

  it("averages ranks across a tied block", () => {
    // Two values tie for ranks 2 and 3 ⇒ both get 2.5.
    expect(rank([1, 5, 5, 9])).toEqual([1, 2.5, 2.5, 4])
  })

  it("gives every element the same rank when all values are equal", () => {
    expect(rank([7, 7, 7])).toEqual([2, 2, 2])
  })

  it("returns an empty array for empty input", () => {
    expect(rank([])).toEqual([])
  })
})

describe("spearman", () => {
  it("returns 1 for perfect rank agreement, even when the relation is non-linear", () => {
    const xs = [0.1, 0.2, 0.3, 0.4]
    const ys = [0.01, 0.5, 0.51, 100]
    expect(spearman(xs, ys)).toBe(1)
  })

  it("returns -1 for perfect rank inversion", () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBe(-1)
  })

  it("handles ties without inventing an ordering", () => {
    // The tied pair carries no directional information; the coefficient stays
    // strictly between the extremes rather than snapping to 1.
    const rho = spearman([1, 2, 2, 3], [10, 20, 30, 40])
    expect(rho).not.toBeNull()
    expect(rho as number).toBeGreaterThan(0)
    expect(rho as number).toBeLessThan(1)
  })

  it("returns null — not 0 — when conviction is constant", () => {
    expect(spearman([0.5, 0.5, 0.5, 0.5], [1, -2, 3, -4])).toBeNull()
  })

  it("returns null — not 0 — when the outcome series is constant", () => {
    expect(spearman([1, 2, 3, 4], [0.02, 0.02, 0.02, 0.02])).toBeNull()
  })

  it("returns null below three pairs", () => {
    expect(spearman([1, 2], [3, 4])).toBeNull()
    expect(spearman([], [])).toBeNull()
  })

  it("throws on a length mismatch rather than truncating", () => {
    expect(() => spearman([1, 2, 3], [1, 2])).toThrow(/length mismatch/)
  })
})
