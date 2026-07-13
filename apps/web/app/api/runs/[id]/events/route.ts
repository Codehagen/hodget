import { notFound, unauthorized } from "@/lib/api"
import { getOwnedRun, isTerminal, runRegistry, type EngineRun, type RunEvent } from "@/lib/dal"
import { getSession } from "@/lib/session"

/**
 * GET /api/runs/[id]/events — Server-Sent Events streaming a run's live progress.
 *
 * 401 without a session; 404 for a run that isn't the current user's. While the
 * run is executing in this process, its emitter is in the registry and every event
 * is forwarded until a terminal (completed/failed) event closes the stream. If the
 * run has already finished (no live emitter), the persisted terminal status is sent
 * once and the stream closes — so a late subscriber still learns the outcome.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  const run = await getOwnedRun(id)
  if (!run) return notFound()

  const encoder = new TextEncoder()
  const emitter = runRegistry.get(id)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Already closed by a disconnect — nothing to do.
        }
      }
      const send = (event: RunEvent) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // Replay a run's persisted terminal outcome, then close. Idempotent: if the
      // live subscription already delivered the terminal event, `closed` is set and
      // both send() and close() no-op, so a client never sees it twice.
      const replayTerminal = (r: EngineRun) => {
        if (r.status === "completed") {
          send({ type: "completed", runId: id, at: r.completedAt ?? new Date().toISOString() })
          close()
        } else if (r.status === "failed") {
          send({
            type: "failed",
            runId: id,
            error: r.error ?? "run failed",
            at: r.completedAt ?? new Date().toISOString(),
          })
          close()
        }
      }

      // No live emitter: the run finished (or runs elsewhere). Replay its terminal
      // status if it has one, then close.
      if (!emitter) {
        replayTerminal(run)
        close()
        return
      }

      const unsubscribe = emitter.subscribe((event) => {
        send(event)
        if (isTerminal(event)) {
          unsubscribe()
          close()
        }
      })

      // Client disconnected: stop forwarding and release the subscription.
      request.signal.addEventListener("abort", () => {
        unsubscribe()
        close()
      })

      // Terminal-event race: the run can emit its terminal event (and begin
      // unregistering) between the getOwnedRun above and runRegistry.get, or finish
      // in the instant after we subscribe — either way the live subscription would
      // never deliver it and the stream would hang open. Re-read the persisted
      // status now and replay it if terminal. Safe because replayTerminal is
      // idempotent against a terminal event the subscription may already have sent.
      const latest = await getOwnedRun(id)
      if (latest) replayTerminal(latest)
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}
