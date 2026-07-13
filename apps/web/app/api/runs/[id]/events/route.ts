import { getRun } from "workflow/api"

import { notFound, unauthorized } from "@/lib/api"
import { getOwnedRun, isTerminal, runRegistry, type EngineRun, type RunEvent } from "@/lib/dal"
import { sseFromRunEvents, terminalEventForRun } from "@/lib/run-events-sse"
import { getSession } from "@/lib/session"

/**
 * GET /api/runs/[id]/events — Server-Sent Events streaming a run's progress.
 *
 * 401 without a session; 404 for a run that isn't the current user's.
 *
 * Durable path (the run has a `workflowRunId`): attach to the workflow run's
 * durable event stream via `getRun(id).getReadable({ startIndex })` and transform
 * each `RunEvent` to an SSE frame. `startIndex` (query param, default 0) lets a
 * late subscriber replay from the beginning — strictly better than the legacy
 * terminal-only replay, and it works across processes because the stream is
 * durable, not process-local. This retires the single-instance SSE limitation.
 *
 * Inline / legacy path (no `workflowRunId`): the original in-process registry +
 * persisted-terminal replay, unchanged.
 */
const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
} as const

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  const run = await getOwnedRun(id)
  if (!run) return notFound()

  // Durable path: read the workflow run's durable stream.
  if (run.workflowRunId) {
    try {
      const startIndexParam = new URL(request.url).searchParams.get("startIndex")
      const parsed = startIndexParam !== null ? Number.parseInt(startIndexParam, 10) : 0
      // Clamp to a non-negative integer: a negative startIndex reaches WDK's
      // getReadable where it means "last N", not "from N", and a non-numeric param
      // parses to NaN. Either would silently change replay semantics, so floor to 0.
      const startIndex = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
      const source = getRun(run.workflowRunId).getReadable<RunEvent>({ startIndex })
      return new Response(
        sseFromRunEvents(source, {
          onEndWithoutTerminal: async () => {
            const latest = await getOwnedRun(id)
            return latest ? terminalEventForRun(latest) : null
          },
        }),
        { headers: SSE_HEADERS },
      )
    } catch {
      // The durable run isn't attachable here (e.g. unknown to this world): fall
      // through to replaying the persisted terminal status below.
    }
  }

  return new Response(legacyEventStream(request, id, run), { headers: SSE_HEADERS })
}

/**
 * The original in-process streaming path: forward the live registry emitter until
 * a terminal event, or replay the persisted terminal status for a finished run.
 * Used for inline-mode runs and any legacy row without a durable stream.
 */
function legacyEventStream(request: Request, id: string, run: EngineRun): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const emitter = runRegistry.get(id)

  return new ReadableStream<Uint8Array>({
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
      // both send() and close() no-op, so a client never sees it twice. Shares
      // terminalEventForRun with the durable path so both synthesize the same frame.
      const replayTerminal = (r: EngineRun) => {
        const terminal = terminalEventForRun(r)
        if (terminal) {
          send(terminal)
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
}
