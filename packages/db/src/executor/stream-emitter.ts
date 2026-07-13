import type { RunEmitter, RunEvent } from "./events.js"

/**
 * A {@link RunEmitter} that writes each event to a `WritableStream<RunEvent>`
 * (plan 004). The durable-workflow step obtains that stream from the Workflow
 * runtime's `getWritable()` and hands it here, so the existing {@link executeRun}
 * runs unmodified while its progress flows onto the run's durable event stream —
 * which a separate SSE request reads via `getRun(id).getReadable()`.
 *
 * This adapter is framework-free: it depends only on the Web Streams API, so it
 * unit-tests against a plain in-memory sink and packages/db never imports any
 * workflow runtime. The stream is best-effort progress; the persisted run status
 * is authoritative, so a stream write failure is logged, not thrown — it must not
 * fail the run (whose result already committed) nor trigger a step retry loop.
 */
export interface StreamRunEmitter extends RunEmitter {
  /**
   * Flush every queued write, then close the stream. Awaited by the step after
   * {@link executeRun} returns so no event is dropped and the writer's lock is
   * released (an unreleased lock keeps the step's request alive until it times
   * out). Never rejects.
   */
  close(): Promise<void>
}

export function createStreamRunEmitter(
  runId: string,
  writable: WritableStream<RunEvent>,
): StreamRunEmitter {
  const writer = writable.getWriter()
  // Serialize writes: emit() is synchronous, but stream writes are async and must
  // preserve order. Each emit chains onto the previous write's promise.
  let chain: Promise<void> = Promise.resolve()
  let failed = false

  const onWriteError = (error: unknown) => {
    if (failed) return
    failed = true
    const message = error instanceof Error ? error.message : String(error)
    console.error(`createStreamRunEmitter: dropped run ${runId} event stream: ${message}`)
  }

  return {
    runId,
    emit(event) {
      chain = chain.then(() => writer.write(event)).catch(onWriteError)
    },
    // No in-process subscribers on the durable path; the SSE route reads the
    // durable stream, not this emitter. Present to satisfy the RunEmitter contract.
    subscribe() {
      return () => {}
    },
    async close() {
      try {
        await chain
        await writer.close()
      } catch (error) {
        onWriteError(error)
      }
    },
  }
}
