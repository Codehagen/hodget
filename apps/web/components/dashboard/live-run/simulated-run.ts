"use client"

import * as React from "react"

import {
  getRunDetail,
  type GateAction,
  type RunDetail,
  type SecurityDecision,
} from "../demo-data"

/**
 * A simulated engine run for the public demo (plan 005).
 *
 * The dialog replays a scripted run entirely client-side — no backend, no API
 * key, and the demo pages stay statically prerendered. The script is derived
 * from the committed fixtures (a completed earnings-drift run's equity curve,
 * metrics, and curated decision days), and its event vocabulary mirrors what
 * the real pipeline emits (`RunEvent` lifecycle + the decision detail the
 * ledger persists), so swapping in a real `EventSource` over
 * `/api/runs/[id]/events` later is a data-source change, not a UI rewrite.
 */

/** The fixture run the simulation replays — completed, earnings-drift panel. */
export const SIMULATED_RUN_ID = "run_8c41ca"

export type FeedEntry =
  | { kind: "lifecycle"; text: string }
  | { kind: "day"; date: string; securities: number }
  | {
      kind: "signal"
      security: string
      analystId: string
      analystKind: "quant" | "llm"
      conviction: number
      thesis: string
    }
  | { kind: "committee"; security: string; netView: number; targetWeight: number }
  | { kind: "gate"; security: string; gate: GateAction }
  | {
      kind: "fill"
      security: string
      side: "buy" | "sell"
      qty: number
      price: number
      session: string
    }
  | { kind: "no-order"; security: string }
  // Real-run kinds (plan 005 seam). The live engine stream (`RunEvent`) is
  // coarser than this scripted feed — it carries only lifecycle, per-day
  // progress, and per-analyst activity; the rich committee/gate/fill detail is
  // persisted and only shows on the completed run's detail page. `useRealRun`
  // emits these two; the script never does.
  | { kind: "day-tick"; date: string; day: number }
  | { kind: "analyst"; security: string; analystId: string }

export type SimulatedRunStatus = "idle" | "queued" | "running" | "completed"

export interface SimulatedRunState {
  status: SimulatedRunStatus
  /** 1-based day counter while sweeping the curve; 0 before the sweep starts. */
  day: number
  totalDays: number
  /** Book equity at the current day (from the fixture curve). */
  equity: number | null
  feed: FeedEntry[]
}

/** One timed step: wait `delay` ms, then fold the patch into the state. */
export type ScriptStep = {
  delay: number
  patch: (state: SimulatedRunState) => SimulatedRunState
}

const INITIAL_STATE: SimulatedRunState = {
  status: "idle",
  day: 0,
  totalDays: 0,
  equity: null,
  feed: [],
}

/* Pacing (ms). The full replay lands around eight seconds: the day counter
 * sweeps the 60-day curve and pauses at each decision day while that day's
 * signals → committee → gate → fill stream into the feed one at a time. */
const QUEUED_MS = 500
const DAY_MS = 45
const DAY_HEADER_MS = 350
const FEED_ENTRY_MS = 250
const COMPLETED_MS = 500

function pushFeed(entry: FeedEntry): ScriptStep["patch"] {
  return (state) => ({ ...state, feed: [...state.feed, entry] })
}

function decisionSteps(security: SecurityDecision): ScriptStep[] {
  const steps: ScriptStep[] = security.signals.map((signal) => ({
    delay: FEED_ENTRY_MS,
    patch: pushFeed({
      kind: "signal",
      security: security.security,
      analystId: signal.analystId,
      analystKind: signal.kind,
      conviction: signal.conviction,
      thesis: signal.thesis,
    }),
  }))
  steps.push({
    delay: FEED_ENTRY_MS,
    patch: pushFeed({
      kind: "committee",
      security: security.security,
      netView: security.committee.netView,
      targetWeight: security.committee.targetWeight,
    }),
  })
  steps.push({
    delay: FEED_ENTRY_MS,
    patch: pushFeed({ kind: "gate", security: security.security, gate: security.gate }),
  })
  steps.push(
    security.fill
      ? {
          delay: FEED_ENTRY_MS,
          patch: pushFeed({
            kind: "fill",
            security: security.security,
            side: security.fill.side,
            qty: security.fill.qty,
            price: security.fill.price,
            session: security.fill.session,
          }),
        }
      : {
          delay: FEED_ENTRY_MS,
          patch: pushFeed({ kind: "no-order", security: security.security }),
        }
  )
  return steps
}

/**
 * Precompute the full timeline from the fixture run detail. Decision days are
 * spread evenly across the curve sweep — the fixtures' curve labels and
 * decision dates come from different mock clocks, so the sweep shows only the
 * day counter and equity, and each decision block carries its own date.
 */
/* Exported for tests (plan 012): the script builder is pure and the tests
 * assert its sequencing without driving timers. */
export function buildScript(detail: RunDetail): ScriptStep[] {
  const totalDays = detail.equity.length
  const decisionDays = detail.decisions
  // Sweep day (1-based) at which each decision day plays back.
  const pauseAt = new Map<number, number>()
  decisionDays.forEach((_, i) => {
    pauseAt.set(Math.round((totalDays * (i + 1)) / (decisionDays.length + 1)), i)
  })

  const steps: ScriptStep[] = [
    {
      delay: 0,
      patch: (state) => ({
        ...state,
        status: "queued",
        totalDays,
        feed: [{ kind: "lifecycle", text: "Run queued" }],
      }),
    },
    {
      delay: QUEUED_MS,
      patch: (state) => ({
        ...state,
        status: "running",
        feed: [
          ...state.feed,
          {
            kind: "lifecycle",
            text: `Run started — ${detail.strategy.name} panel, ${totalDays} trading days`,
          },
        ],
      }),
    },
  ]

  for (let day = 1; day <= totalDays; day++) {
    const equity = detail.equity[day - 1]!.equity
    steps.push({
      delay: DAY_MS,
      patch: (state) => ({ ...state, day, equity }),
    })
    const decisionIndex = pauseAt.get(day)
    if (decisionIndex !== undefined) {
      const decisionDay = decisionDays[decisionIndex]!
      steps.push({
        delay: DAY_HEADER_MS,
        patch: pushFeed({
          kind: "day",
          date: decisionDay.date,
          securities: decisionDay.securities.length,
        }),
      })
      for (const security of decisionDay.securities) {
        steps.push(...decisionSteps(security))
      }
    }
  }

  steps.push({
    delay: COMPLETED_MS,
    patch: (state) => ({
      ...state,
      status: "completed",
      feed: [
        ...state.feed,
        { kind: "lifecycle", text: "Run completed — results persisted to the ledger" },
      ],
    }),
  })

  return steps
}

/**
 * Drive the simulated run. A single self-rescheduling timeout walks the
 * precomputed script (an interval could drift or overlap); closing the dialog
 * or unmounting cancels the walker mid-flight.
 */
export function useSimulatedRun() {
  // The fixture is committed and the id is a constant, so the detail always
  // resolves; the fallback keeps the hook total rather than trusting that.
  const detail = React.useMemo(() => getRunDetail(SIMULATED_RUN_ID) ?? null, [])
  const [state, setState] = React.useState<SimulatedRunState>(INITIAL_STATE)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = React.useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  React.useEffect(() => cancel, [cancel])

  const reset = React.useCallback(() => {
    cancel()
    setState(INITIAL_STATE)
  }, [cancel])

  const start = React.useCallback(() => {
    if (!detail) return
    cancel()
    setState(INITIAL_STATE)
    const script = buildScript(detail)
    let index = 0
    const walk = () => {
      const step = script[index]
      if (!step) {
        timer.current = null
        return
      }
      index += 1
      timer.current = setTimeout(() => {
        setState(step.patch)
        walk()
      }, step.delay)
    }
    walk()
  }, [cancel, detail])

  return { state, detail, start, reset }
}
