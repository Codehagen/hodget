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
  /**
   * The durable-stream index of the first event `source` will yield (plan 016).
   * Must match whatever `startIndex` the caller passed to WDK's
   * `getRun(...).getReadable({ startIndex })` — the two are the same coordinate
   * space, so every frame's `id:` line stays aligned with `getReadable`'s index
   * semantics. Defaults to 0 (a stream read from the beginning).
   */
  readonly startIndex?: number
}

/**
 * Adapt a stream of {@link RunEvent}s (the workflow run's durable event stream)
 * into a Server-Sent Events byte stream (plan 004). Each event becomes an
 * `id: <index>\ndata: <json>\n\n` frame — byte-for-byte the same wire shape the
 * in-process path emits, plus a stamped `id:` (plan 016) — and the stream closes
 * as soon as a terminal event (completed/failed) is seen or the source ends,
 * whichever comes first. If the source ends without a terminal event,
 * `onEndWithoutTerminal` gets a chance to synthesize one.
 *
 * `id:` contract: the first frame carries `id: options.startIndex` (default 0),
 * and each subsequent frame increments by one. The browser's native `EventSource`
 * remembers the last `id:` it saw and resends it as the `Last-Event-ID` request
 * header on reconnect — the route maps that header straight back onto
 * `getReadable`'s `startIndex`, so a dropped connection resumes instead of
 * replaying the run from the start. This id must therefore equal the durable
 * stream's own index for that event, not just a locally-counted sequence number.
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
  let nextIndex = options.startIndex ?? 0

  const frame = (value: RunEvent): Uint8Array => {
    const id = nextIndex++
    return encoder.encode(`id: ${id}\ndata: ${JSON.stringify(value)}\n\n`)
  }

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
            if (fallback) controller.enqueue(frame(fallback))
          }
          controller.close()
          return
        }
        controller.enqueue(frame(value))
        if (isTerminal(value)) {
          sawTerminal = true
          // The terminal frame is already delivered; if the upstream broke in
          // the meantime (streams pre-pull, so cancel can surface that error)
          // it no longer matters — never let it error the closed response.
          try {
            await reader.cancel()
          } catch {
            // Upstream already errored after the terminal; nothing to release.
          }
          controller.close()
        }
      } catch (error) {
        // A durable-stream read error must not strand the client without a
        // terminal frame: fall back to the run's persisted status, exactly
        // like the clean end-of-stream path. A null fallback (run not
        // terminal yet) still errors the stream — EventSource auto-reconnect
        // then re-attaches, which is right for a transient mid-run failure.
        if (!sawTerminal) {
          try {
            const fallback = await options.onEndWithoutTerminal?.()
            if (fallback) {
              controller.enqueue(frame(fallback))
              controller.close()
              return
            }
          } catch {
            // Fall through to controller.error below.
          }
        }
        controller.error(error)
      }
    },
    cancel(reason) {
      // Client disconnected: release the upstream durable-stream reader.
      void reader.cancel(reason)
    },
  })
}
