// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useSimulatedRun } from "@/components/dashboard/live-run/simulated-run"

/**
 * The self-rescheduling timeout walker (plan 012): with fake timers the
 * replay runs to completion deterministically, and reset() must cancel the
 * pending timeout so no patch lands afterwards.
 */

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useSimulatedRun", () => {
  it("walks the script to completed under fake timers", () => {
    const { result } = renderHook(() => useSimulatedRun())
    expect(result.current.state.status).toBe("idle")

    act(() => {
      result.current.start()
    })
    act(() => {
      vi.runAllTimers()
    })

    expect(result.current.state.status).toBe("completed")
    expect(result.current.state.day).toBe(result.current.state.totalDays)
  })

  it("reset() cancels the pending timeout — no patches land afterwards", () => {
    const { result } = renderHook(() => useSimulatedRun())

    act(() => {
      result.current.start()
    })
    // Let the replay get partway in.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.state.status).not.toBe("idle")

    act(() => {
      result.current.reset()
    })
    expect(result.current.state.status).toBe("idle")

    // If the walker survived reset, these timers would fold more patches.
    act(() => {
      vi.runAllTimers()
    })
    expect(result.current.state.status).toBe("idle")
    expect(result.current.state.feed).toEqual([])
  })

  it("unmount clears the pending timeout", () => {
    const { result, unmount } = renderHook(() => useSimulatedRun())
    act(() => {
      result.current.start()
    })
    unmount()
    // Draining timers after unmount must not throw (setState on unmounted
    // components warns/errors under strict async handling).
    expect(() => vi.runAllTimers()).not.toThrow()
  })
})
