import { describe, expect, it } from "vitest"

import {
  buildScript,
  SIMULATED_RUN_ID,
  type FeedEntry,
  type SimulatedRunState,
} from "@/components/dashboard/live-run/simulated-run"
import { getRunDetail } from "@/components/dashboard/demo-data"

/**
 * The simulated-run script (plan 012): buildScript is pure over the committed
 * fixtures, so its sequencing is asserted directly by folding every patch —
 * no timers involved. The walker/cancellation behavior is covered in
 * simulated-run.hook.test.tsx.
 */

const detail = getRunDetail(SIMULATED_RUN_ID)!

const INITIAL: SimulatedRunState = {
  status: "idle",
  day: 0,
  totalDays: 0,
  equity: null,
  feed: [],
}

/** Fold the whole script and record each intermediate state. */
function foldAll(): SimulatedRunState[] {
  const states: SimulatedRunState[] = []
  let state = INITIAL
  for (const step of buildScript(detail)) {
    state = step.patch(state)
    states.push(state)
  }
  return states
}

describe("buildScript", () => {
  it("starts queued → started and ends completed with the closing feed entry", () => {
    const states = foldAll()
    expect(states[0]!.status).toBe("queued")
    expect(states[0]!.feed[0]).toEqual({ kind: "lifecycle", text: "Run queued" })
    expect(states[1]!.status).toBe("running")

    const final = states[states.length - 1]!
    expect(final.status).toBe("completed")
    const lastEntry = final.feed[final.feed.length - 1] as FeedEntry
    expect(lastEntry.kind).toBe("lifecycle")
  })

  it("sweeps every trading day exactly once, monotonically", () => {
    const days: number[] = []
    let last = 0
    for (const state of foldAll()) {
      if (state.day !== last) {
        days.push(state.day)
        last = state.day
      }
    }
    expect(days).toEqual(
      Array.from({ length: detail.equity.length }, (_, i) => i + 1)
    )
  })

  it("plays every fixture decision day: header + per-security signal/committee/gate/fill entries", () => {
    const final = foldAll().at(-1)!
    const feed = final.feed

    const dayHeaders = feed.filter((e) => e.kind === "day")
    expect(dayHeaders.map((e) => (e.kind === "day" ? e.date : ""))).toEqual(
      detail.decisions.map((d) => d.date)
    )

    for (const decisionDay of detail.decisions) {
      for (const security of decisionDay.securities) {
        const signals = feed.filter(
          (e) => e.kind === "signal" && e.security === security.security
        )
        expect(signals.length).toBeGreaterThanOrEqual(security.signals.length)
        expect(
          feed.some(
            (e) => e.kind === "committee" && e.security === security.security
          )
        ).toBe(true)
        expect(
          feed.some((e) => e.kind === "gate" && e.security === security.security)
        ).toBe(true)
        const settlement = security.fill ? "fill" : "no-order"
        expect(
          feed.some(
            (e) => e.kind === settlement && e.security === security.security
          )
        ).toBe(true)
      }
    }
  })

  it("tracks the fixture equity curve on the final day", () => {
    const final = foldAll().at(-1)!
    expect(final.totalDays).toBe(detail.equity.length)
    expect(final.equity).toBe(detail.equity[detail.equity.length - 1]!.equity)
  })
})
