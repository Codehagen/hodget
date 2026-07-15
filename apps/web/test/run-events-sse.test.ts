import { describe, expect, it, vi } from "vitest"

/**
 * Unit tests for the durable-stream → SSE transform (plan 004). `@/lib/dal` is
 * mocked to its `isTerminal` helper so the transform is exercised in isolation
 * (and without importing @workspace/db, which the DAL boundary forbids in tests)
 * against a stubbed `ReadableStream<RunEvent>`.
 */
vi.mock("@/lib/dal", () => ({
  isTerminal: (e: { type: string }) => e.type === "completed" || e.type === "failed",
}))

import type { RunEvent } from "@/lib/dal"
import { sseFromRunEvents, terminalEventForRun } from "@/lib/run-events-sse"

/** A ReadableStream that emits the given events then closes. */
function sourceOf(events: RunEvent[]): ReadableStream<RunEvent> {
  return new ReadableStream<RunEvent>({
    start(controller) {
      for (const e of events) controller.enqueue(e)
      controller.close()
    },
  })
}

/** Drain an SSE byte stream into decoded text. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value)
  }
  return out
}

/** Parse SSE `data:` frames back into objects. */
function frames(text: string): RunEvent[] {
  return text
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)) as RunEvent)
}

describe("sseFromRunEvents", () => {
  it("emits one data: frame per event, preserving the wire shape", async () => {
    const events: RunEvent[] = [
      { type: "started", runId: "r1", at: "t0" },
      { type: "progress", runId: "r1", asOf: "2026-01-02", day: 1 },
      { type: "analyst", runId: "r1", analystId: "llm.value", securityId: "S", asOf: "2026-01-02" },
      { type: "completed", runId: "r1", at: "t9" },
    ]
    const text = await drain(sseFromRunEvents(sourceOf(events)))

    // Exact frame format, byte-for-byte.
    expect(text).toContain('data: {"type":"started","runId":"r1","at":"t0"}\n\n')
    expect(frames(text)).toEqual(events)
  })

  it("closes as soon as a terminal event is seen, ignoring later chunks", async () => {
    const events: RunEvent[] = [
      { type: "started", runId: "r1", at: "t0" },
      { type: "completed", runId: "r1", at: "t9" },
      // Should never be forwarded — the transform closes on the terminal event.
      { type: "progress", runId: "r1", asOf: "2026-01-03", day: 2 },
    ]
    const parsed = frames(await drain(sseFromRunEvents(sourceOf(events))))
    expect(parsed.map((e) => e.type)).toEqual(["started", "completed"])
  })

  it("ends when the source ends even without a terminal event", async () => {
    const events: RunEvent[] = [{ type: "started", runId: "r1", at: "t0" }]
    const parsed = frames(await drain(sseFromRunEvents(sourceOf(events))))
    expect(parsed.map((e) => e.type)).toEqual(["started"])
  })

  it("forwards a failed terminal event and closes", async () => {
    const events: RunEvent[] = [
      { type: "started", runId: "r1", at: "t0" },
      { type: "failed", runId: "r1", error: "provider down", at: "t9" },
    ]
    const parsed = frames(await drain(sseFromRunEvents(sourceOf(events))))
    expect(parsed.at(-1)).toEqual({ type: "failed", runId: "r1", error: "provider down", at: "t9" })
  })

  it("synthesizes a terminal frame from persisted status when the source ends without one", async () => {
    // A late subscriber attaches to an already-expired durable stream: it ends
    // (`done`) after only non-terminal frames, so the fallback must append the
    // run's persisted terminal outcome instead of leaving the client hanging.
    const events: RunEvent[] = [{ type: "started", runId: "r1", at: "t0" }]
    const parsed = frames(
      await drain(
        sseFromRunEvents(sourceOf(events), {
          onEndWithoutTerminal: () => ({ type: "completed", runId: "r1", at: "persisted" }),
        }),
      ),
    )
    expect(parsed.map((e) => e.type)).toEqual(["started", "completed"])
    expect(parsed.at(-1)).toEqual({ type: "completed", runId: "r1", at: "persisted" })
  })

  it("does not consult the persisted-status fallback once a terminal event streamed", async () => {
    const onEnd = vi.fn(() => ({ type: "completed", runId: "r1", at: "persisted" }) as RunEvent)
    const events: RunEvent[] = [
      { type: "started", runId: "r1", at: "t0" },
      { type: "completed", runId: "r1", at: "t9" },
    ]
    const parsed = frames(await drain(sseFromRunEvents(sourceOf(events), { onEndWithoutTerminal: onEnd })))
    expect(parsed.map((e) => e.type)).toEqual(["started", "completed"])
    expect(onEnd).not.toHaveBeenCalled()
  })
})

describe("terminalEventForRun", () => {
  it("maps a completed run to a completed event carrying its completion time", () => {
    expect(
      terminalEventForRun({ id: "r1", status: "completed", completedAt: "t9", error: null } as never),
    ).toEqual({ type: "completed", runId: "r1", at: "t9" })
  })

  it("maps a failed run to a failed event carrying its error", () => {
    expect(
      terminalEventForRun({ id: "r1", status: "failed", completedAt: "t9", error: "boom" } as never),
    ).toEqual({ type: "failed", runId: "r1", error: "boom", at: "t9" })
  })

  it("returns null for a run that is not yet terminal", () => {
    expect(terminalEventForRun({ id: "r1", status: "running" } as never)).toBeNull()
  })
})

/** A ReadableStream that emits the given events then errors. Pull-based so
 * each event is actually delivered before the error (error() inside start()
 * would discard queued chunks per the Streams spec). */
function erroringSourceOf(events: RunEvent[]): ReadableStream<RunEvent> {
  let i = 0
  return new ReadableStream<RunEvent>({
    pull(controller) {
      if (i < events.length) {
        controller.enqueue(events[i++]!)
        return
      }
      controller.error(new Error("durable stream broke"))
    },
  })
}

describe("sseFromRunEvents — mid-stream errors (plan 011)", () => {
  it("falls back to the persisted terminal on a read error", async () => {
    const progress: RunEvent = { type: "progress", runId: "r1", asOf: "d", day: 1 }
    const terminal: RunEvent = { type: "completed", runId: "r1", at: "t9" }
    const text = await drain(
      sseFromRunEvents(erroringSourceOf([progress]), {
        onEndWithoutTerminal: () => terminal,
      })
    )
    expect(frames(text)).toEqual([progress, terminal])
  })

  it("errors the stream when the run is not terminal yet (null fallback)", async () => {
    const stream = sseFromRunEvents(erroringSourceOf([]), {
      onEndWithoutTerminal: () => null,
    })
    await expect(drain(stream)).rejects.toThrow("durable stream broke")
  })

  it("never double-emits a terminal seen before the error", async () => {
    const terminal: RunEvent = { type: "completed", runId: "r1", at: "t9" }
    const text = await drain(
      sseFromRunEvents(erroringSourceOf([terminal]), {
        onEndWithoutTerminal: () => terminal,
      })
    )
    expect(frames(text)).toEqual([terminal])
  })
})
