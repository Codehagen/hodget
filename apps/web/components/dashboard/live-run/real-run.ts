"use client"

import * as React from "react"

import type { FeedEntry } from "./simulated-run"
import {
  metricsFromEngine,
  type RunDialogError,
  type RunDialogState,
  type RunSource,
} from "./run-source"

/**
 * The real engine data source for the New-run dialog (plan 005 seam): for
 * signed-in `/dashboard` users, `start()` POSTs a run to `/api/runs`, then attaches
 * an `EventSource` to `/api/runs/[id]/events` and folds the live `RunEvent`s into
 * the same {@link RunDialogState} the scripted simulation produces — so the dialog
 * renders one way for two sources. The `/demo` surface keeps `useSimulatedRun`.
 *
 * The live stream is deliberately coarser than the scripted feed: the engine emits
 * only lifecycle, per-day progress, and per-analyst activity (the committee / gate
 * / fill detail is persisted, and shows on the completed run's detail page). On
 * completion the metrics are fetched from `/api/runs/[id]` and mapped for the
 * result StatBar.
 *
 * Failure handling:
 *  - POST 401 (session expired) → an `auth` error the dialog turns into a sign-in
 *    prompt.
 *  - a `failed` event → the engine's error message.
 *  - a dropped stream after the browser gives up reconnecting → fall back to the
 *    run's persisted status (the plan-011 fallback, applied client-side). If the
 *    run already finished, resolve to that terminal outcome; a 401 here surfaces
 *    the same sign-in prompt; otherwise a `disconnected` state that keeps the run
 *    linkable without pretending it is still streaming.
 */

/** Client-safe mirror of the engine's `RunEvent` wire contract (canonical:
 * `packages/db/src/executor/events.ts`). The stream is untrusted JSON, so the
 * hook narrows on `type` rather than trusting the parsed shape. */
type WireRunEvent =
  | { type: "started"; runId: string; at: string }
  | { type: "progress"; runId: string; asOf: string; day: number }
  | { type: "analyst"; runId: string; analystId: string; securityId: string; asOf: string }
  | { type: "completed"; runId: string; at: string }
  | { type: "failed"; runId: string; error: string; at: string }

/** The default backtest: the earnings-drift quant panel over the full fixture
 * dataset (range + universe default to the dataset's own coverage). Matches the
 * executor's tested config exactly, so a signed-in "New run" is always valid. */
export const DEFAULT_RUN_CONFIG = {
  panel: { analysts: [{ id: "quant.earnings-drift", weight: 1 }] },
  initialCash: { USD: 100_000 },
} as const

export const REAL_RUN_STRATEGY_NAME = "earnings-drift"

/** Bound the feed so a long run can't grow the DOM without limit; the scroller
 * pins to the tail, so only the most recent entries are ever on screen. */
const MAX_FEED = 400

/** `EventSource.readyState === CLOSED`: the browser has stopped reconnecting.
 * (0 CONNECTING · 1 OPEN · 2 CLOSED — the DOM constant.) */
const EVENT_SOURCE_CLOSED = 2

/** The minimal `EventSource` surface the hook uses — injectable so the component
 * tests (jsdom has no `EventSource`) can drive the stream with a fake. */
export interface EventSourceLike {
  /** 0 CONNECTING · 1 OPEN · 2 CLOSED (mirrors the DOM `EventSource`). */
  readonly readyState: number
  onmessage: ((ev: { data: string }) => void) | null
  onerror: ((ev: unknown) => void) | null
  close: () => void
}

export interface UseRealRunOptions {
  /** Defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch
  /** Defaults to `new EventSource(url)`. */
  readonly eventSourceFactory?: (url: string) => EventSourceLike
}

const INITIAL_STATE: RunDialogState = {
  status: "idle",
  runIdLabel: null,
  detailRunId: null,
  day: 0,
  totalDays: 0,
  equity: null,
  feed: [],
  metrics: null,
  error: null,
}

const AUTH_EXPIRED: RunDialogError = {
  kind: "auth",
  message: "Your session has expired. Sign in to start a run.",
}

const CONNECTION_LOST: RunDialogError = {
  kind: "connection",
  message:
    "Connection to the run stream was lost. The run may still be executing — open it from the runs list to see its final result.",
}

function appendFeed(feed: FeedEntry[], entry: FeedEntry): FeedEntry[] {
  const next = [...feed, entry]
  return next.length > MAX_FEED ? next.slice(next.length - MAX_FEED) : next
}

function defaultEventSource(url: string): EventSourceLike {
  // EventSource's handler types are broader than EventSourceLike's; the cast is
  // safe because we only ever read `data`/`readyState` and assign the handlers.
  return new EventSource(url) as unknown as EventSourceLike
}

export function useRealRun(options: UseRealRunOptions = {}): RunSource {
  const [state, setState] = React.useState<RunDialogState>(INITIAL_STATE)

  // Options can change identity between renders; read them through a ref so the
  // stable callbacks always see the latest without re-subscribing. Updated in an
  // effect (never during render) — start() is only invoked from a click, long
  // after the first commit, so it never sees a stale value.
  const optionsRef = React.useRef(options)
  React.useEffect(() => {
    optionsRef.current = options
  })

  const esRef = React.useRef<EventSourceLike | null>(null)
  const runIdRef = React.useRef<string | null>(null)
  // Set once a terminal event or a final error has been handled, so a late
  // stream error (EventSource closes after a clean terminal) can't re-fire.
  const settledRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  // Generation counter: reset() bumps it, and every async continuation and stream
  // handler carries the generation it was started under. A stale generation (the
  // dialog was closed / a new run started) no-ops — so a slow POST or a late
  // stream event can never revive a reset run.
  const epochRef = React.useRef(0)

  /** True while `epoch` is still the live generation and the hook is mounted. */
  const isCurrent = React.useCallback(
    (epoch: number) => mountedRef.current && epochRef.current === epoch,
    [],
  )

  const setStateFor = React.useCallback(
    (epoch: number, updater: (prev: RunDialogState) => RunDialogState) => {
      if (isCurrent(epoch)) setState(updater)
    },
    [isCurrent],
  )

  const closeStream = React.useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const reset = React.useCallback(() => {
    // Invalidate every in-flight generation before tearing down.
    epochRef.current += 1
    closeStream()
    settledRef.current = false
    runIdRef.current = null
    if (mountedRef.current) setState(INITIAL_STATE)
  }, [closeStream])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      closeStream()
    }
  }, [closeStream])

  // Fetch the completed run's persisted metrics for the result StatBar. Even if
  // this fails, the run itself completed — mark it completed with null metrics
  // rather than surfacing a spurious error.
  const finishCompleted = React.useCallback(
    async (runId: string, epoch: number) => {
      if (!isCurrent(epoch)) return
      settledRef.current = true
      closeStream()
      const fetchImpl = optionsRef.current.fetchImpl ?? fetch
      let metrics: RunDialogState["metrics"] = null
      try {
        const res = await fetchImpl(`/api/runs/${runId}`)
        if (res.ok) {
          const detail: unknown = await res.json()
          metrics = metricsFromEngine(
            (detail as { result?: { metrics?: unknown } })?.result?.metrics,
          )
        }
      } catch {
        // Metrics unavailable — the run still completed.
      }
      setStateFor(epoch, (s) => ({
        ...s,
        status: "completed",
        metrics,
        feed: appendFeed(s.feed, {
          kind: "lifecycle",
          text: "Run completed — results persisted to the ledger",
        }),
      }))
    },
    [closeStream, isCurrent, setStateFor],
  )

  const failWith = React.useCallback(
    (error: RunDialogError, lifecycleText: string | undefined, epoch: number) => {
      if (!isCurrent(epoch)) return
      settledRef.current = true
      closeStream()
      setStateFor(epoch, (s) => ({
        ...s,
        status: "failed",
        error,
        feed: lifecycleText
          ? appendFeed(s.feed, { kind: "lifecycle", text: lifecycleText })
          : s.feed,
      }))
    },
    [closeStream, isCurrent, setStateFor],
  )

  const handleEvent = React.useCallback(
    (raw: string, epoch: number) => {
      if (!isCurrent(epoch)) return
      let ev: WireRunEvent
      try {
        ev = JSON.parse(raw) as WireRunEvent
      } catch {
        return
      }
      switch (ev.type) {
        case "started":
          setStateFor(epoch, (s) => ({
            ...s,
            status: "running",
            feed: appendFeed(s.feed, {
              kind: "lifecycle",
              text: `Run started — ${REAL_RUN_STRATEGY_NAME} panel`,
            }),
          }))
          break
        case "progress":
          setStateFor(epoch, (s) => ({
            ...s,
            status: "running",
            day: ev.day,
            feed: appendFeed(s.feed, {
              kind: "day-tick",
              date: ev.asOf.slice(0, 10),
              day: ev.day,
            }),
          }))
          break
        case "analyst":
          setStateFor(epoch, (s) => ({
            ...s,
            feed: appendFeed(s.feed, {
              kind: "analyst",
              security: ev.securityId,
              analystId: ev.analystId,
            }),
          }))
          break
        case "completed":
          void finishCompleted(ev.runId, epoch)
          break
        case "failed":
          failWith({ kind: "run", message: ev.error }, `Run failed — ${ev.error}`, epoch)
          break
      }
    },
    [failWith, finishCompleted, isCurrent, setStateFor],
  )

  // The browser gave up reconnecting before a terminal event: recover the run's
  // persisted status (plan 011's terminal fallback, applied from the client).
  // Resolve to the real outcome if the run already finished; a 401 surfaces the
  // sign-in prompt; otherwise a `disconnected` state that keeps the run linkable.
  const handleStreamError = React.useCallback(
    async (epoch: number) => {
      if (!isCurrent(epoch)) return
      if (settledRef.current) return
      settledRef.current = true
      closeStream()
      const runId = runIdRef.current
      const fetchImpl = optionsRef.current.fetchImpl ?? fetch
      if (runId) {
        try {
          const res = await fetchImpl(`/api/runs/${runId}`)
          if (res.status === 401) {
            setStateFor(epoch, (s) => ({ ...s, status: "failed", error: AUTH_EXPIRED }))
            return
          }
          if (res.ok) {
            const detail = (await res.json()) as {
              run?: { status?: string; error?: string | null }
            }
            const status = detail.run?.status
            if (status === "completed") {
              // Hand off to the metrics path; let it own the terminal write.
              settledRef.current = false
              await finishCompleted(runId, epoch)
              return
            }
            if (status === "failed") {
              const message = detail.run?.error ?? "run failed"
              failWith({ kind: "run", message }, `Run failed — ${message}`, epoch)
              return
            }
          }
        } catch {
          // Fall through to the disconnected notice.
        }
      }
      // Still running (or unknown): the stream is gone but the run may continue.
      setStateFor(epoch, (s) => ({ ...s, status: "disconnected", error: CONNECTION_LOST }))
    },
    [closeStream, failWith, finishCompleted, isCurrent, setStateFor],
  )

  const openStream = React.useCallback(
    (runId: string, epoch: number) => {
      if (!isCurrent(epoch)) return
      const factory = optionsRef.current.eventSourceFactory ?? defaultEventSource
      const es = factory(`/api/runs/${runId}/events`)
      esRef.current = es
      es.onmessage = (event) => handleEvent(event.data, epoch)
      es.onerror = () => {
        // Native EventSource auto-reconnects on transient drops (idle proxy
        // timeouts, network blips). Only act once the browser has actually given
        // up (readyState CLOSED); otherwise let auto-reconnect proceed.
        if (es.readyState === EVENT_SOURCE_CLOSED) void handleStreamError(epoch)
      }
    },
    [handleEvent, handleStreamError, isCurrent],
  )

  const start = React.useCallback(() => {
    reset()
    // reset() bumped the generation; every continuation below is tagged with it.
    const epoch = epochRef.current
    const fetchImpl = optionsRef.current.fetchImpl ?? fetch

    setStateFor(epoch, (s) => ({
      ...s,
      status: "queued",
      feed: [{ kind: "lifecycle", text: "Run queued" }],
    }))

    void (async () => {
      let res: Response
      try {
        res = await fetchImpl("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(DEFAULT_RUN_CONFIG),
        })
      } catch {
        failWith(
          {
            kind: "connection",
            message: "Could not reach the engine. Check your connection and try again.",
          },
          undefined,
          epoch,
        )
        return
      }
      if (!isCurrent(epoch)) return

      if (res.status === 401) {
        settledRef.current = true
        setStateFor(epoch, (s) => ({ ...s, status: "failed", error: AUTH_EXPIRED }))
        return
      }
      if (!res.ok) {
        failWith(
          { kind: "run", message: `The engine rejected the run (HTTP ${res.status}).` },
          undefined,
          epoch,
        )
        return
      }

      let run: { id?: unknown }
      try {
        run = (await res.json()) as { id?: unknown }
      } catch {
        failWith({ kind: "run", message: "The engine returned an invalid response." }, undefined, epoch)
        return
      }
      if (!isCurrent(epoch)) return
      if (typeof run.id !== "string") {
        failWith({ kind: "run", message: "The engine returned a run without an id." }, undefined, epoch)
        return
      }

      runIdRef.current = run.id
      const runId = run.id
      setStateFor(epoch, (s) => ({ ...s, runIdLabel: runId, detailRunId: runId }))
      openStream(runId, epoch)
    })()
  }, [failWith, isCurrent, openStream, reset, setStateFor])

  return { state, strategyName: REAL_RUN_STRATEGY_NAME, start, reset }
}
