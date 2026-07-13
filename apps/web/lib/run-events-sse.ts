import { isTerminal, type EngineRun, type RunEvent } from "@/lib/dal"

/**
 * Build the terminal {@link RunEvent} that a run's persisted status implies, or
 * `null` if the run has not reached a terminal state. The single source of truth
 * for replaying a finished run's outcome — used both by the legacy in-process
 * stream and by the durable stream's end-without-terminal fallback, so both paths
 * synthesize byte-identical terminal frames.
 */
export function terminalEventForRun(run: EngineRun): RunEvent | null {
  if (run.status === "completed") {
    return { type: "completed", runId: run.id, at: run.completedAt ?? new Date().toISOString() }
  }
  if (run.status === "failed") {
    return {
      type: "failed",
      runId: run.id,
      error: run.error ?? "run failed",
      at: run.completedAt ?? new Date().toISOString(),
    }
  }
  return null
}

export interface SseFromRunEventsOptions {
  /**
   * Called when the durable source ends (`done`) without ever emitting a terminal
   * event. Return a synthesized terminal event — from the run's persisted status —
   * to emit as a final frame, or `null` if the run is not terminal yet. This is
   * how a late subscriber to an already-expired durable stream still receives a
   * terminal frame instead of hanging open (mirrors the legacy `replayTerminal`).
   */
  readonly onEndWithoutTerminal?: () => Promise<RunEvent | null> | RunEvent | null
}

/**
 * Adapt a stream of {@link RunEvent}s (the workflow run's durable event stream)
 * into a Server-Sent Events byte stream (plan 004). Each event becomes a
 * `data: <json>\n\n` frame — byte-for-byte the same wire shape the in-process path
 * emits — and the stream closes as soon as a terminal event (completed/failed) is
 * seen or the source ends, whichever comes first. If the source ends without a
 * terminal event, `onEndWithoutTerminal` gets a chance to synthesize one.
 *
 * Pure and runtime-agnostic (no workflow imports), so it unit-tests against a
 * stubbed `ReadableStream<RunEvent>`.
 */
export function sseFromRunEvents(
  source: ReadableStream<RunEvent>,
  options: SseFromRunEventsOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const reader = source.getReader()
  let sawTerminal = false

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          // The durable stream ended without a terminal frame (e.g. an expired
          // stream a late subscriber attached to): fall back to the run's
          // persisted status so the client never hangs waiting for a terminal.
          if (!sawTerminal) {
            const fallback = await options.onEndWithoutTerminal?.()
            if (fallback) controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`))
          }
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
        if (isTerminal(value)) {
          sawTerminal = true
          await reader.cancel()
          controller.close()
        }
      } catch (error) {
        controller.error(error)
      }
    },
    cancel(reason) {
      // Client disconnected: release the upstream durable-stream reader.
      void reader.cancel(reason)
    },
  })
}
