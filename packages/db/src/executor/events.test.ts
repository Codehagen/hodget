import { describe, expect, it } from "vitest"

import { createRunEmitter, isTerminal, RunRegistry, type RunEvent } from "./events.js"

describe("createRunEmitter", () => {
  it("fans out to current subscribers and stops after unsubscribe", () => {
    const emitter = createRunEmitter("run-1")
    const seen: RunEvent[] = []
    const unsubscribe = emitter.subscribe((e) => seen.push(e))

    emitter.emit({ type: "started", runId: "run-1", at: "t0" })
    unsubscribe()
    emitter.emit({ type: "completed", runId: "run-1", at: "t1" })

    expect(seen).toHaveLength(1)
    expect(seen[0]?.type).toBe("started")
  })

  it("flags terminal events", () => {
    expect(isTerminal({ type: "completed", runId: "r", at: "t" })).toBe(true)
    expect(isTerminal({ type: "failed", runId: "r", error: "x", at: "t" })).toBe(true)
    expect(isTerminal({ type: "started", runId: "r", at: "t" })).toBe(false)
  })
})

describe("concurrent runs do not cross-talk", () => {
  it("keeps two interleaved runs' events fully isolated", () => {
    const registry = new RunRegistry()
    const a = createRunEmitter("run-a")
    const b = createRunEmitter("run-b")
    registry.register(a)
    registry.register(b)

    const seenA: string[] = []
    const seenB: string[] = []
    registry.get("run-a")?.subscribe((e) => seenA.push(e.runId))
    registry.get("run-b")?.subscribe((e) => seenB.push(e.runId))

    // Interleave emissions across the two runs.
    a.emit({ type: "started", runId: "run-a", at: "t0" })
    b.emit({ type: "started", runId: "run-b", at: "t0" })
    a.emit({ type: "progress", runId: "run-a", asOf: "2026-01-02", day: 1 })
    b.emit({ type: "progress", runId: "run-b", asOf: "2026-01-02", day: 1 })
    a.emit({ type: "completed", runId: "run-a", at: "t1" })
    b.emit({ type: "completed", runId: "run-b", at: "t1" })

    // Each subscriber saw ONLY its own run's events — no bleed-through.
    expect(seenA).toEqual(["run-a", "run-a", "run-a"])
    expect(seenB).toEqual(["run-b", "run-b", "run-b"])
  })

  it("unregister removes the emitter from the lookup", () => {
    const registry = new RunRegistry()
    const emitter = createRunEmitter("run-x")
    registry.register(emitter)
    expect(registry.get("run-x")).toBe(emitter)
    registry.unregister("run-x")
    expect(registry.get("run-x")).toBeUndefined()
  })
})
