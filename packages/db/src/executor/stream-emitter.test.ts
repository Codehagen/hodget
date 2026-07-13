import { describe, expect, it } from "vitest"

import type { RunEvent } from "./events.js"
import { createStreamRunEmitter } from "./stream-emitter.js"

/** A WritableStream that records every chunk, plus whether it was closed. */
function sink(): { writable: WritableStream<RunEvent>; chunks: RunEvent[]; closed: () => boolean } {
  const chunks: RunEvent[] = []
  let closed = false
  const writable = new WritableStream<RunEvent>({
    write(chunk) {
      chunks.push(chunk)
    },
    close() {
      closed = true
    },
  })
  return { writable, chunks, closed: () => closed }
}

describe("createStreamRunEmitter", () => {
  it("writes emitted events to the stream in order and closes it", async () => {
    const { writable, chunks, closed } = sink()
    const emitter = createStreamRunEmitter("run-1", writable)

    emitter.emit({ type: "started", runId: "run-1", at: "2026-01-01T00:00:00.000Z" })
    emitter.emit({ type: "progress", runId: "run-1", asOf: "2026-01-02", day: 1 })
    emitter.emit({ type: "completed", runId: "run-1", at: "2026-01-03T00:00:00.000Z" })

    await emitter.close()

    expect(chunks.map((c) => c.type)).toEqual(["started", "progress", "completed"])
    expect(chunks[1]).toEqual({ type: "progress", runId: "run-1", asOf: "2026-01-02", day: 1 })
    expect(closed()).toBe(true)
  })

  it("exposes the run id it was created for", () => {
    const { writable } = sink()
    expect(createStreamRunEmitter("run-xyz", writable).runId).toBe("run-xyz")
  })

  it("never throws from emit/close when the underlying stream errors", async () => {
    const writable = new WritableStream<RunEvent>({
      write() {
        throw new Error("stream is broken")
      },
    })
    const emitter = createStreamRunEmitter("run-2", writable)

    // A best-effort progress stream must not crash the run; the DB status is
    // authoritative. emit is fire-and-forget; close swallows and resolves.
    expect(() => emitter.emit({ type: "started", runId: "run-2", at: "t" })).not.toThrow()
    await expect(emitter.close()).resolves.toBeUndefined()
  })

  it("subscribe is a no-op on the durable path (SSE reads the durable stream)", () => {
    const { writable } = sink()
    const emitter = createStreamRunEmitter("run-3", writable)
    const unsubscribe = emitter.subscribe(() => {
      throw new Error("should never be called")
    })
    emitter.emit({ type: "started", runId: "run-3", at: "t" })
    expect(() => unsubscribe()).not.toThrow()
  })
})
