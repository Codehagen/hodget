/**
 * Plain-language fixtures + evidence derivations for the Strategies page.
 *
 * The redesigned Strategies surface explains each strategy in plain English —
 * what it looks at, why it might work, and whether it held up out of sample.
 * The technical registry (versions, panel weights, promotion gates, validation
 * runs) already lives in `../demo-data.ts`; this module is READ-ONLY over that
 * data. It adds two things on top:
 *
 *   1. Authored plain-language copy per strategy (descriptions, the advisor
 *      questions, the "why this might work" bullets, decision summaries) — the
 *      redesign's voice, kept out of the shared technical fixtures.
 *   2. Derivations that reshape the existing promotion + validation fixtures
 *      into the evidence the new panels render (mean OOS Sharpe, worst OOS
 *      drawdown, the out-of-sample dot-plot points, per-gate evidence text).
 *
 * Everything is deterministic — the derivations are pure functions of the
 * committed fixtures, so the panel body can never drift from the selected row.
 */

import {
  getStrategyDetail,
  getValidationHistory,
  type DecisionResult,
  type PromotionGate,
} from "../demo-data"

/* ------------------------------------------------------------------ */
/* Advisor questions — the plain question each signal answers          */
/* ------------------------------------------------------------------ */

/**
 * The italic, plain-language question behind each panel signal. Keyed by the
 * signal name used in `demo-data`'s `decisionSystem.panel`, shared across
 * strategies so a signal reads the same wherever it appears.
 */
export const ADVISOR_QUESTIONS: Record<string, string> = {
  "Value LLM": "Is the company cheap relative to fundamentals?",
  "Earnings drift": "Are surprise and estimate revisions improving?",
  "Quality quant": "Are returns, leverage, and accruals healthy?",
  "Macro context": "Does the rates, growth, and liquidity regime support the view?",
  Momentum: "Is the trend strong and still intact?",
  "Mean reversion": "Has the price overshot and is it likely to snap back?",
  Sentiment: "Is the tone of news and filings turning?",
}

/** The plain question for a signal, falling back to its technical note. */
export function advisorQuestion(signal: string, fallback: string): string {
  return ADVISOR_QUESTIONS[signal] ?? fallback
}

/* ------------------------------------------------------------------ */
/* Authored copy — the redesign's plain-language voice per strategy    */
/* ------------------------------------------------------------------ */

export type StrategyDecisionRow = {
  security: string
  view: string
  target: string
  result: DecisionResult
}

export type StrategyCopy = {
  /** One-sentence plain description shown under the inspector title. */
  plainDescription: string
  /** Meta line: "42 US and Oslo securities · long-only · reviewed weekly". */
  metaLine: string
  /** Green-dot "Why this might work" bullets. */
  whyItWorks: string[]
  /** Italic footer under the bullets — the "does not place trades" caveat. */
  whyFooter: string
  /** Green answer line on the out-of-sample card. */
  oosAnswer: string
  /** A few recent committee decisions for the Decisions tab. */
  decisions: StrategyDecisionRow[]
}

const STRATEGY_COPY: Record<string, StrategyCopy> = {
  "value-panel": {
    plainDescription:
      "Looks for companies where valuation, earnings revisions, and quality point in the same direction, while macro context can temper the view.",
    metaLine: "42 US and Oslo securities · long-only · reviewed weekly",
    whyItWorks: [
      "Valuation creates a margin of safety",
      "Positive earnings revisions provide a near-term catalyst",
      "Quality filters reduce value traps",
    ],
    whyFooter: "Macro context moderates exposure; it does not place trades.",
    oosAnswer: "Yes, but live approval still requires human risk review.",
    decisions: [
      { security: "JPM", view: "Cheap vs tangible book", target: "+6.5%", result: "passed" },
      { security: "KO", view: "Defensive premium looks full", target: "-2.1%", result: "passed" },
      { security: "PFE", view: "Pipeline optionality under-priced", target: "+2.4%", result: "clipped" },
    ],
  },
  "earnings-drift": {
    plainDescription:
      "Trades around earnings surprises, holding through the window where prices keep drifting after a large beat or miss.",
    metaLine: "38 US technology securities · long/short · reviewed per print",
    whyItWorks: [
      "Prices under-react to large earnings surprises",
      "Estimate revisions confirm the direction of the drift",
      "Quality screens keep the book out of fragile balance sheets",
    ],
    whyFooter: "Macro context sets risk appetite; it does not place trades.",
    oosAnswer: "Yes — this strategy is live and trading with an approved risk review.",
    decisions: [
      { security: "NVDA", view: "Large upside surprise, drift open", target: "+5.0%", result: "clipped" },
      { security: "AAPL", view: "Modest services beat", target: "+3.2%", result: "passed" },
      { security: "MSFT", view: "Azure decelerating; fade the pop", target: "-1.4%", result: "passed" },
    ],
  },
  "momentum-carry": {
    plainDescription:
      "Leans into securities that are already trending, adds a carry tilt, and confirms the move with improving fundamentals.",
    metaLine: "120 global large-cap securities · long/short · reviewed monthly",
    whyItWorks: [
      "Trends persist longer than most investors expect",
      "Carry pays you to hold the position while you wait",
      "Earnings revisions filter out hollow, low-quality rallies",
    ],
    whyFooter: "Macro context tilts exposure by regime; it does not place trades.",
    oosAnswer: "Partly — backtest and walk-forward look promising, but it has not been paper-traded yet.",
    decisions: [
      { security: "NVDA", view: "Top-decile momentum, positive carry", target: "+5.0%", result: "clipped" },
      { security: "TSM", view: "Momentum plus rising utilization", target: "+4.5%", result: "passed" },
      { security: "ASML.AS", view: "Momentum rolled over post guide-down", target: "-3.0%", result: "vetoed" },
    ],
  },
  "ose-energy": {
    plainDescription:
      "Takes macro-driven long and short views on Oslo Børs energy names, anchored to the Brent term structure and reserve-based valuation.",
    metaLine: "14 Oslo energy securities · long/short · reviewed weekly",
    whyItWorks: [
      "Energy names track the Brent term structure closely",
      "Reserve-based valuation flags cheap producers",
      "Trading-update revisions catch inflections early",
    ],
    whyFooter: "Sentiment shades conviction at the margin; it does not place trades.",
    oosAnswer: "Not yet — out-of-sample Sharpe is still below the promotion bar.",
    decisions: [
      { security: "EQNR.OL", view: "Brent backwardation tailwind", target: "+5.5%", result: "passed" },
      { security: "AKRBP.OL", view: "High torque to Brent, covered dividend", target: "+3.8%", result: "vetoed" },
      { security: "VAR.OL", view: "Cost inflation offsets price gain", target: "-2.2%", result: "passed" },
    ],
  },
  "mean-reversion": {
    plainDescription:
      "Fades short-term dislocations in liquid ETFs, sizes down when volatility is high, and steps aside when a name is simply cheap for a reason.",
    metaLine: "24 US sector and index ETFs · long/short · reviewed daily",
    whyItWorks: [
      "Liquid ETFs snap back after crowded, headline-driven moves",
      "Volatility scaling keeps position sizes sane in stress",
      "A value anchor avoids fighting genuine repricings",
    ],
    whyFooter: "Sentiment dampens headline-driven spikes; it does not place trades.",
    oosAnswer: "Yes, but live approval still requires human risk review.",
    decisions: [
      { security: "XLE", view: "Two-sigma washout, no news", target: "+4.0%", result: "passed" },
      { security: "SPY", view: "Stretched above the upper band", target: "-2.0%", result: "clipped" },
      { security: "XLK", view: "Mild oversold into an up-trend", target: "+1.2%", result: "passed" },
    ],
  },
}

const FALLBACK_COPY: StrategyCopy = STRATEGY_COPY["value-panel"]!

/** Plain-language copy for a strategy, falling back to the flagship panel. */
export function getStrategyCopy(id: string): StrategyCopy {
  return STRATEGY_COPY[id] ?? FALLBACK_COPY
}

/* ------------------------------------------------------------------ */
/* Evidence — derived from the shared promotion + validation fixtures  */
/* ------------------------------------------------------------------ */

/** First signed number in a string, or `null` if none (e.g. "-8.4%" → -8.4). */
function parseNum(input: string): number | null {
  const match = input.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function gateNamed(
  gates: PromotionGate[],
  gate: string
): PromotionGate | undefined {
  return gates.find((g) => g.gate === gate)
}

const QUARTER = (month: number) => Math.floor((month - 1) / 3) + 1

/**
 * Quarter label for a validation period, named after the quarter the OOS window
 * opens in: "2024-05-15 → 2024-08-14 (OOS)" → "2024 Q2". A window that crosses a
 * calendar year is shown as a range: "2024-11-15 → 2025-02-14" → "2024 Q4–2025
 * Q1". (Windows land on the 15th, so most straddle two calendar quarters within
 * one year — those still read as the single opening quarter.)
 */
function periodQuarterLabel(period: string): string {
  const dates = period.match(/(\d{4})-(\d{2})-\d{2}/g) ?? []
  if (dates.length === 0) return period
  const at = (iso: string) => {
    const [y, m] = iso.split("-")
    return { year: Number(y), q: QUARTER(Number(m)) }
  }
  const start = at(dates[0]!)
  const end = at(dates[dates.length - 1]!)
  const left = `${start.year} Q${start.q}`
  if (start.year === end.year) return left
  return `${left}–${end.year} Q${end.q}`
}

/** One point in the out-of-sample Sharpe dot-plot, oldest → newest. */
export type OosPoint = {
  /** Column label, e.g. "2024 Q2 OOS" or "Latest backtest". */
  label: string
  sharpe: number
  /** Preformatted drawdown for that period, e.g. "-9.1%". */
  drawdown: string
  /** The most recent point (the latest backtest) renders hollow. */
  isBacktest: boolean
}

/** One promotion gate, with its status and a single line of evidence. */
export type GateEvidence = {
  gate: string
  status: PromotionGate["status"]
  /** "1.37 ≥ 0.80", "43 / 60 days", "Risk review pending". */
  evidence: string
}

export type StrategyEvidence = {
  /** Latest backtest Sharpe, e.g. "1.37". */
  latestBacktestSharpe: string
  /** Mean out-of-sample Sharpe (the walk-forward result), e.g. "0.98". */
  meanOosSharpe: string
  /** Worst out-of-sample drawdown across validation runs, e.g. "-10.2%". */
  worstOosDrawdown: string
  /** Paper observation progress, e.g. "43 / 60 days" (or "—" if not started). */
  paperObservation: string
  /** The required OOS Sharpe threshold (walk-forward bar), e.g. 0.6. */
  oosThreshold: number
  /** Dot-plot points, oldest → newest. */
  points: OosPoint[]
  /** Path-to-live gate rows with evidence text. */
  gates: GateEvidence[]
}

/** Combine a gate's criteria + details into one evidence line. */
function gateEvidenceText(gate: PromotionGate): string {
  const threshold = parseNum(gate.criteria)
  const value = gate.details.trim()
  // "1.37" against "Sharpe ≥ 0.80" → "1.37 ≥ 0.80"; anything wordier is verbatim.
  if (threshold != null && /^-?\d+(?:\.\d+)?$/.test(value)) {
    return `${value} ≥ ${threshold.toFixed(2)}`
  }
  return gate.details
}

/**
 * Derive the evidence panels for a strategy from its promotion gates and
 * validation history. Pure — same committed fixtures in, same numbers out.
 */
export function getStrategyEvidence(id: string): StrategyEvidence {
  const detail = getStrategyDetail(id)
  const history = getValidationHistory(id)

  const backtest = gateNamed(detail.promotionEvidence, "Backtest")
  const walkForward = gateNamed(detail.promotionEvidence, "Walk-forward")
  const paper = gateNamed(detail.promotionEvidence, "Paper observation")

  const latestBacktestSharpe = backtest?.details.trim() ?? "—"
  const meanOosSharpe =
    (walkForward ? parseNum(walkForward.details) : null)?.toFixed(2) ?? "—"
  const oosThreshold = (walkForward ? parseNum(walkForward.criteria) : null) ?? 0.6

  // Worst (most negative) drawdown across every validation run.
  const worst = history.reduce<{ row: string; value: number } | null>(
    (acc, row) => {
      const value = parseNum(row.maxDrawdown)
      if (value == null) return acc
      if (!acc || value < acc.value) return { row: row.maxDrawdown, value }
      return acc
    },
    null
  )
  const worstOosDrawdown = worst?.row ?? "—"

  // Validation history is authored newest-first; the dot-plot reads left→right
  // oldest→newest, so reverse it. The backtest run is the most recent point.
  const points: OosPoint[] = [...history]
    .reverse()
    .map((row) => ({
      label:
        row.gate === "Backtest"
          ? "Latest backtest"
          : `${periodQuarterLabel(row.period)} OOS`,
      sharpe: row.sharpe,
      drawdown: row.maxDrawdown,
      isBacktest: row.gate === "Backtest",
    }))

  const gates: GateEvidence[] = detail.promotionEvidence.map((gate) => ({
    gate: gate.gate,
    status: gate.status,
    evidence: gateEvidenceText(gate),
  }))

  return {
    latestBacktestSharpe,
    meanOosSharpe,
    worstOosDrawdown,
    paperObservation: paper?.details.trim() ?? "—",
    oosThreshold,
    points,
    gates,
  }
}
