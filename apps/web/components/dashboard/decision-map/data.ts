/**
 * Decision-map fixture — the plain-language model behind the Decisions page.
 *
 * Every map is DERIVED from a single decision row (the same shape the run-detail
 * decision log reads), so the map's header, KPIs and its nodes can never
 * disagree: a clipped row draws a "Safety reduced it" gate with matching target
 * weights, a "No trade" row draws no execution fill, a vetoed row draws a
 * blocked gate and no fill. The one flagship decision shown in the product mock
 * (`dec_c12f8b7a`, NVDA) matches its values and copy exactly; every other
 * decision id derives a consistent map from the same functions.
 *
 * The page reshapes the map into a plain-language explainer, so alongside the
 * structural fields (weights, sizes, prices) each node also carries the
 * human-readable strings the mock shows — headline, explainer paragraph, advisor
 * words and theses, the committee sentence, the safety reason, ledger fields.
 * These are derived per row too; the flagship's are pinned to the mock.
 *
 * Pure and deterministic — no `Date.now()`/`Math.random()` — so the /demo routes
 * prerender cleanly and server and client agree byte-for-byte. Layout (x/y
 * positions, edges) lives in `layout.ts`; this file is the domain model.
 */

import type { AnalystKind, DecisionLogRow, DecisionResult, RunMode } from "../demo-data"
import { DECISION_LOG, getRunById } from "../demo-data"

/* ------------------------------------------------------------------ */
/* Node data shapes                                                    */
/* ------------------------------------------------------------------ */

export type EvidenceItem = { title: string; time: string; source: string }

/** Signed tone bucket, shared by the KPI strip and gate words. */
export type Tone = "success" | "muted" | "destructive" | "warning"

export type DataSourceNodeData = {
  ticker: string
  /** Known-at cutoff, e.g. "2025-05-15 13:50 UTC". */
  cutoff: string
  /** Just the time part, e.g. "13:50 UTC". */
  knownAt: string
  sources: { label: string; ok: boolean }[]
  state: string
}

/** A one-word read of a conviction: Positive / Cautious / Negative / Neutral. */
export type ConvictionWord = "Positive" | "Cautious" | "Negative" | "Neutral"

export type AnalystViewNodeData = {
  analystId: string
  name: string
  kind: AnalystKind
  version: string
  conviction: number
  word: ConvictionWord
  horizonDays: number
  /** Plain-language, one sentence. */
  thesis: string
  weight: number
  /** Included in the committee blend, or excluded (e.g. different horizon). */
  included: boolean
  excludedReason?: string
  /** Footer verb: "Used" when blended, "Heard, not combined" when excluded. */
  usedLabel: string
  /* Inspector detail — presentational, from the fixture. */
  evidence: EvidenceItem[]
  renderedContext: string
  prompt: string
  model: string
  parseVerified: boolean
}

export type CommitteeContributor = { name: string; weight: number; conviction: number }
export type CommitteeExcluded = { name: string; horizon: string; conviction: number }

export type CommitteeNodeData = {
  dominantHorizon: string
  /** Plain result read, e.g. "Result: positive view". */
  resultLabel: string
  /** One-sentence explanation of why the included views combined as they did. */
  sentence: string
  included: CommitteeContributor[]
  excluded: CommitteeExcluded[]
  netView: number
  /** Weights of the included (blended) views, e.g. 0.65. */
  sumWeights: number
  /** Note about a preserved-but-not-blended dissent, when there is one. */
  dissentNote: string | null
  method: string
}

export type Side = "BUY" | "SELL"

export type ConstructionNodeData = {
  proposedTargetPct: number
  side: Side
  size: number
}

export type RiskGateNodeData = {
  result: DecisionResult
  /** Plain headline: "Safety reduced it" / "Safety blocked it" / "Within safety limits". */
  headline: string
  reason: string
  fromPct: number
  toPct: number
  approvedSide: Side
  approvedSize: number
}

export type ExecutionNodeData = {
  filled: boolean
  status: string
  side: Side
  qty: number
  price: number
  /** e.g. "2025-05-16 open". */
  timeline: string
  ledgerId: string
}

/** The header-card KPI strip: combined view, proposed/approved sizing, status. */
export type DecisionKpis = {
  combinedView: number
  proposedPct: number | null
  approvedPct: number | null
  statusLabel: string
  statusTone: Tone
}

export type DecisionMap = {
  id: string
  ticker: string
  timestamp: string
  /** Time-only, e.g. "13:52:31 UTC". */
  time: string
  mode: RunMode
  executed: boolean
  runId: string
  /** Plain headline, e.g. "Bought 412 NVDA shares at $184.20". */
  headline: string
  /** One-paragraph, plain-language explanation of the whole decision. */
  explainer: string
  /** Compact action for the left rail, e.g. "Bought 412" / "Target 2.5%" / "No trade". */
  actionLine: string
  kpis: DecisionKpis
  provenance: {
    dataset: string
    panel: string
    deterministicReplay: boolean
  }
  data: DataSourceNodeData
  analysts: AnalystViewNodeData[]
  committee: CommitteeNodeData
  /** Null when there is no position to construct (a no-trade decision). */
  construction: ConstructionNodeData | null
  risk: RiskGateNodeData
  /** Null when nothing was executed (no-trade or vetoed). */
  execution: ExecutionNodeData | null
  /** Analyst whose path is highlighted + selected by default (the lead view). */
  primaryAnalystId: string
}

/* ------------------------------------------------------------------ */
/* Derivation helpers                                                  */
/* ------------------------------------------------------------------ */

const FLAGSHIP_ID = "dec_c12f8b7a"

// The three panel views the value-panel committee weighs, mirroring the trace
// in demo-data (Value / Earnings drift / Macro). Convictions come from the
// decision row's agreement vector; Macro runs a longer horizon, so it is
// excluded from a shorter-horizon committee blend.
const ANALYST_META = [
  { analystId: "value", name: "Value", kind: "llm" as AnalystKind, version: "v3.2.1", agreementIndex: 0, horizonDays: 10, weight: 0.35, prompt: "value_v3.2.1", model: "gpt-4o-2024-08-06" },
  { analystId: "earnings-drift", name: "Earnings drift", kind: "quant" as AnalystKind, version: "v2.4.0", agreementIndex: 1, horizonDays: 10, weight: 0.3, prompt: "—", model: "surprise-zscore-v6" },
  { analystId: "macro-context", name: "Macro context", kind: "llm" as AnalystKind, version: "v2.1.0", agreementIndex: 3, horizonDays: 21, weight: 0.2, prompt: "macro_v2.1.0", model: "gpt-4o-2024-08-06" },
] as const

const DOMINANT_HORIZON_DAYS = 10

// FNV-1a → 6 hex chars, for stable synthetic ids (context, ledger) on the
// non-flagship decisions. Deterministic per input.
function hex6(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 6)
}

function nextTradingDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

type ParsedFill = { side: Side; qty: number; price: number } | null

// "BUY 412 @ $184.20" → { side, qty, price }; "No trade" → null.
function parseFill(fill: string): ParsedFill {
  const m = fill.match(/^(BUY|SELL)\s+([\d,]+)\s+@\s+\$([\d.]+)$/)
  if (!m) return null
  return {
    side: m[1] as Side,
    qty: Number(m[2]!.replace(/,/g, "")),
    price: Number(m[3]),
  }
}

/** Positive / Cautious / Negative / Neutral — matches the mock's advisor words. */
function convictionWord(value: number): ConvictionWord {
  if (value >= 0.15) return "Positive"
  if (value <= -0.15) return "Negative"
  if (value < 0) return "Cautious"
  return "Neutral"
}

// Plain-language thesis per ticker (one sentence, the way the mock phrases it),
// consistent with an analyst's card + inspector so they read the same story.
const THESIS: Record<string, [string, string, string]> = {
  NVDA: [
    "Cash generation and margins looked stronger than peers.",
    "Estimates and guidance were moving upward.",
    "Rates could pressure valuation.",
  ],
  AAPL: [
    "Trading near fair value on a durable services mix.",
    "Estimates kept drifting steadily higher after the print.",
    "Consumer softness was a modest headwind.",
  ],
  EQNR: [
    "Cash returns and the buyback underpinned the valuation.",
    "Revisions turned positive on firmer Brent.",
    "Tighter supply was a near-term tailwind.",
  ],
  DNB: [
    "Cheap on book value, but the credit cycle was turning.",
    "Estimate revisions were flat to lower.",
    "Rate-sensitive, with spreads widening.",
  ],
  MSFT: [
    "Rich on every multiple after the run.",
    "Revisions were cooling into the print.",
    "A crowded factor made the entry risky.",
  ],
  CASH: [
    "No name cleared the entry bar this session.",
    "Signals were mixed with nothing decisive.",
    "Staying in cash kept risk low.",
  ],
}

// Exact inspector evidence for the flagship NVDA decision (matches the mock,
// plain-language titles). Other decisions derive a single evidence item.
const FLAGSHIP_EVIDENCE: Record<string, EvidenceItem[]> = {
  value: [
    { title: "Free-cash-flow yield stronger than peers", time: "2025-05-15 13:31 UTC", source: "Fundamentals" },
    { title: "EPS estimates up 4.2% over 60 days", time: "2025-05-15 13:22 UTC", source: "Estimates" },
    { title: "Gross margin expanded 220 bps", time: "2025-05-15 13:18 UTC", source: "Fundamentals" },
  ],
  "earnings-drift": [
    { title: "Standardized earnings surprise +2.1σ", time: "2025-05-15 13:29 UTC", source: "Estimates" },
    { title: "Post-announcement drift window still open", time: "2025-05-15 13:24 UTC", source: "Prices" },
  ],
  "macro-context": [
    { title: "Real-rate path steepening on the 21-day horizon", time: "2025-05-15 13:20 UTC", source: "Macro" },
    { title: "Multiple-compression risk into a data-heavy window", time: "2025-05-15 13:14 UTC", source: "Macro" },
  ],
}

const FLAGSHIP_CONTEXT: Record<string, string> = {
  value: "ctx_09f4a1b6",
  "earnings-drift": "ctx_3a71c0e2",
  "macro-context": "ctx_b45e77d1",
}

function buildAnalysts(row: DecisionLogRow): AnalystViewNodeData[] {
  const isFlagship = row.decisionId === FLAGSHIP_ID
  const theses = THESIS[row.ticker] ?? [
    "Valuation view recorded for this name.",
    "Revision-momentum view recorded for this name.",
    "Macro-regime view recorded for this name.",
  ]

  return ANALYST_META.map((meta, i) => {
    const conviction = row.agreement[meta.agreementIndex] ?? 0
    const included = meta.horizonDays === DOMINANT_HORIZON_DAYS
    const thesis = theses[i] ?? "—"

    const evidence: EvidenceItem[] = isFlagship
      ? FLAGSHIP_EVIDENCE[meta.analystId] ?? []
      : [{ title: thesis, time: `${row.date} 13:2${i} UTC`, source: meta.kind === "quant" ? "Estimates" : "Fundamentals" }]

    const renderedContext = isFlagship
      ? FLAGSHIP_CONTEXT[meta.analystId] ?? `ctx_${hex6(row.decisionId + meta.analystId)}`
      : `ctx_${hex6(row.decisionId + meta.analystId)}`

    return {
      analystId: meta.analystId,
      name: meta.name,
      kind: meta.kind,
      version: meta.version,
      conviction,
      word: convictionWord(conviction),
      horizonDays: meta.horizonDays,
      thesis,
      weight: meta.weight,
      included,
      excludedReason: included ? undefined : "Different time horizon",
      usedLabel: included ? "Used" : "Heard, not combined",
      evidence,
      renderedContext,
      prompt: meta.prompt,
      model: meta.model,
      parseVerified: true,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Plain-language derivation                                           */
/* ------------------------------------------------------------------ */

// Flagship copy pinned to the mock. Non-flagship decisions derive equivalents.
const FLAGSHIP_HEADLINE = "Bought 412 NVDA shares at $184.20"
const FLAGSHIP_EXPLAINER =
  "Two short-horizon advisors saw upside. Safety rules reduced the proposed position from 8.5% to 6.0% because technology exposure was already high."

function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`
}

function committeeResultLabel(netView: number): string {
  if (netView >= 0.15) return "Result: positive view"
  if (netView <= -0.15) return "Result: negative view"
  return "Result: neutral view"
}

function committeeSentence(includedCount: number, netView: number, horizon: string): string {
  const n = includedCount === 1 ? "single" : includedCount === 2 ? "two" : `${includedCount}`
  const noun = includedCount === 1 ? "view" : "views"
  if (netView >= 0.15) return `The ${n} compatible ${horizon} ${noun} both supported buying.`
  if (netView <= -0.15) return `The ${n} compatible ${horizon} ${noun} pointed toward trimming.`
  return `The ${n} compatible ${horizon} ${noun} were inconclusive.`
}

/* ------------------------------------------------------------------ */
/* Decision map                                                        */
/* ------------------------------------------------------------------ */

function buildDecisionMap(row: DecisionLogRow, runId: string): DecisionMap {
  const isFlagship = row.decisionId === FLAGSHIP_ID
  const analysts = buildAnalysts(row)
  const included = analysts.filter((a) => a.included)
  const excluded = analysts.filter((a) => !a.included)

  const fill = parseFill(row.nextSessionFill)
  const vetoed = row.riskGate === "vetoed"
  const clipped = row.riskGate === "clipped"
  const hasPosition = row.targetWeight !== 0 || fill != null
  const side: Side = fill?.side ?? (row.committeeView >= 0 ? "BUY" : "SELL")

  // A clipped gate reduces a proposed weight down to the row's target; a vetoed
  // gate blocks it to zero; a passed gate leaves it. Sizes scale with the pre-gate
  // weight (e.g. 412 @ 6.00% ← 584 @ 8.50% for the flagship). When there is no
  // share-level fill, sizes are estimated from the target weight so the
  // construction/execution nodes still read coherently.
  const toPct = row.targetWeight
  const fromPct = clipped ? row.targetWeight + 2.5 : row.targetWeight
  const approvedSize = fill?.qty ?? Math.max(0, Math.round(Math.abs(toPct) * 68))
  const proposedSize =
    fill && fromPct !== 0 && toPct !== 0
      ? Math.round((approvedSize * fromPct) / toPct)
      : Math.max(0, Math.round(Math.abs(fromPct) * 68))

  const construction: ConstructionNodeData | null = hasPosition
    ? { proposedTargetPct: fromPct, side, size: proposedSize }
    : null

  const risk: RiskGateNodeData = vetoed
    ? {
        result: "vetoed",
        headline: "Safety blocked it",
        reason: "Gross-exposure limit",
        fromPct,
        toPct: 0,
        approvedSide: side,
        approvedSize: 0,
      }
    : clipped
      ? {
          result: "clipped",
          headline: "Safety reduced it",
          reason: isFlagship ? "Technology concentration limit" : "Concentration limit",
          fromPct,
          toPct,
          approvedSide: side,
          approvedSize,
        }
      : hasPosition
        ? {
            result: "passed",
            headline: "Within safety limits",
            reason: "Within concentration and gross-exposure limits",
            fromPct: toPct,
            toPct,
            approvedSide: side,
            approvedSize,
          }
        : {
            result: "passed",
            headline: "Nothing to size",
            reason: "Below the entry threshold",
            fromPct: 0,
            toPct: 0,
            approvedSide: side,
            approvedSize: 0,
          }

  const execution: ExecutionNodeData | null =
    fill && !vetoed
      ? {
          filled: true,
          status: "FILLED",
          side: fill.side,
          qty: fill.qty,
          price: fill.price,
          timeline: `${nextTradingDay(row.date)} open`,
          ledgerId: isFlagship ? "fill_72a91c" : `fill_${hex6(row.decisionId)}`,
        }
      : null

  // Headline + compact action line.
  let headline: string
  let actionLine: string
  if (execution) {
    const verb = execution.side === "BUY" ? "Bought" : "Sold"
    headline = `${verb} ${execution.qty} ${row.ticker} shares at $${execution.price.toFixed(2)}`
    actionLine = `${verb} ${execution.qty}`
  } else if (vetoed) {
    headline = `No ${row.ticker} trade — vetoed by safety`
    actionLine = "No trade"
  } else if (clipped && construction) {
    headline = `Set ${row.ticker} target to ${fmtPct(toPct)}`
    actionLine = `Target ${toPct.toFixed(1)}%`
  } else if (construction) {
    headline = `Set ${row.ticker} target to ${fmtPct(toPct)}`
    actionLine = `Target ${toPct.toFixed(1)}%`
  } else {
    headline = row.ticker === "CASH" ? "Held cash — no new position" : `No ${row.ticker} trade this session`
    actionLine = "No trade"
  }
  if (isFlagship) headline = FLAGSHIP_HEADLINE

  // KPI status.
  const statusLabel = execution
    ? "Filled"
    : vetoed
      ? "Vetoed"
      : construction
        ? "Target set"
        : "No trade"
  const statusTone: Tone = execution
    ? "success"
    : vetoed
      ? "destructive"
      : "muted"

  const kpis: DecisionKpis = {
    combinedView: row.committeeView,
    proposedPct: construction ? construction.proposedTargetPct : null,
    approvedPct: construction ? risk.toPct : null,
    statusLabel,
    statusTone,
  }

  // Explainer paragraph.
  let explainer: string
  if (isFlagship) {
    explainer = FLAGSHIP_EXPLAINER
  } else {
    const dir = row.committeeView >= 0.15 ? "upside" : row.committeeView <= -0.15 ? "downside" : "little to act on"
    const lead = `${included.length === 1 ? "One short-horizon advisor" : `${included.length} short-horizon advisors`} saw ${dir}.`
    const tail = vetoed
      ? " Safety rules blocked the position to keep exposure within limits."
      : clipped
        ? ` Safety rules reduced the proposed position from ${fmtPct(fromPct)} to ${fmtPct(toPct)}.`
        : execution
          ? " Safety rules left the position within limits, and it filled next session."
          : " No position cleared the entry threshold, so nothing traded."
    explainer = lead + tail
  }

  const sumWeights = included.reduce((s, a) => s + a.weight, 0)
  const dominantHorizon = `${DOMINANT_HORIZON_DAYS}d`
  const dissentNote = isFlagship
    ? "Macro dissent is preserved but not blended because it covers 21 days."
    : excluded.length > 0
      ? `${excluded[0]!.name} dissent is preserved but not blended because it covers ${excluded[0]!.horizonDays} days.`
      : null

  const run = getRunById(runId)

  return {
    id: row.decisionId,
    ticker: row.ticker,
    timestamp: `${row.date} ${row.time} UTC`,
    time: `${row.time} UTC`,
    mode: run?.mode ?? "backtest",
    executed: execution != null,
    runId,
    headline,
    explainer,
    actionLine,
    kpis,
    provenance: {
      dataset: "ds_9a7e52b1",
      panel: "value-panel@v3.2.1",
      deterministicReplay: true,
    },
    data: {
      ticker: row.ticker,
      cutoff: `${row.date} 13:50 UTC`,
      knownAt: "13:50 UTC",
      sources: [
        { label: "Fundamentals", ok: true },
        { label: "Estimates", ok: true },
        { label: "Prices", ok: true },
      ],
      state: "Verified",
    },
    analysts,
    committee: {
      dominantHorizon,
      resultLabel: committeeResultLabel(row.committeeView),
      sentence: isFlagship
        ? "The two compatible 10-day views both supported buying."
        : committeeSentence(included.length, row.committeeView, dominantHorizon),
      included: included.map((a) => ({ name: a.name, weight: a.weight, conviction: a.conviction })),
      excluded: excluded.map((a) => ({ name: a.name, horizon: `${a.horizonDays}d`, conviction: a.conviction })),
      netView: row.committeeView,
      sumWeights,
      dissentNote,
      method: "Weighted blend · abstentions excluded",
    },
    construction,
    risk,
    execution,
    primaryAnalystId: included[0]?.analystId ?? analysts[0]!.analystId,
  }
}

/* ------------------------------------------------------------------ */
/* Today's decisions (the standalone Decisions page)                   */
/* ------------------------------------------------------------------ */

/**
 * The list shown in the left rail — one trading day of decisions, in the shape
 * the mock lays out. The flagship (NVDA) reuses the canonical decision row so
 * its map is byte-identical to the per-run page; the other rows are curated for
 * this day. Each carries its own display run id. EQNR is a clipped, target-only
 * decision (no share fill), MSFT a vetoed proposal, CASH a stay-in-cash pass —
 * so the page exercises every honest gate + no-trade path.
 */
type TodayItem = { row: DecisionLogRow; runId: string }

const TODAY_ITEMS: TodayItem[] = [
  {
    runId: "run_8c41cf",
    row: { id: "dl_today_nvda", date: "2025-05-15", time: "13:52:31", ticker: "NVDA", agreement: [0.82, 0.61, 0.2, -0.14], committeeView: 0.53, targetWeight: 6.0, riskGate: "clipped", nextSessionFill: "BUY 412 @ $184.20", decisionId: "dec_c12f8b7a" },
  },
  {
    runId: "run_9a1e7b2",
    row: { id: "dl_today_aapl", date: "2025-05-15", time: "13:41:12", ticker: "AAPL", agreement: [0.6, 0.4, 0.15, -0.5], committeeView: 0.41, targetWeight: 5.5, riskGate: "passed", nextSessionFill: "BUY 286 @ $189.44", decisionId: "dec_e88a3d21" },
  },
  {
    runId: "run_3317a6e",
    row: { id: "dl_today_eqnr", date: "2025-05-15", time: "13:21:07", ticker: "EQNR", agreement: [0.5, 0.3, 0.1, -0.2], committeeView: 0.22, targetWeight: 2.5, riskGate: "clipped", nextSessionFill: "No trade", decisionId: "dec_7a3e1f90" },
  },
  {
    runId: "run_21f56a3",
    row: { id: "dl_today_dnb", date: "2025-05-15", time: "12:47:16", ticker: "DNB", agreement: [-0.3, -0.1, 0.1, -0.2], committeeView: -0.08, targetWeight: 0.0, riskGate: "passed", nextSessionFill: "No trade", decisionId: "dec_b91e4c33" },
  },
  {
    runId: "run_5d2b9f1",
    row: { id: "dl_today_msft", date: "2025-05-15", time: "11:33:02", ticker: "MSFT", agreement: [-0.1, -0.05, 0.0, -0.02], committeeView: -0.05, targetWeight: -3.5, riskGate: "vetoed", nextSessionFill: "No trade", decisionId: "dec_5c2b9d41" },
  },
  {
    runId: "run_0f7c2d4",
    row: { id: "dl_today_cash", date: "2025-05-15", time: "10:22:00", ticker: "CASH", agreement: [0.05, -0.02, 0.0, -0.01], committeeView: 0.0, targetWeight: 0.0, riskGate: "passed", nextSessionFill: "No trade", decisionId: "dec_0f7c2d4a" },
  },
]

/** A compact left-rail summary of one decision, derived from its map. */
export type TodayRailItem = {
  decisionId: string
  ticker: string
  /** "HH:MM". */
  time: string
  actionLine: string
  view: number
  gateWord: string
  gateTone: Tone
  runId: string
}

const GATE_WORD: Record<DecisionResult, string> = {
  passed: "Passed",
  clipped: "Reduced",
  vetoed: "Vetoed",
}

function railItem(item: TodayItem): TodayRailItem {
  const map = buildDecisionMap(item.row, item.runId)
  return {
    decisionId: map.id,
    ticker: map.ticker,
    time: item.row.time.slice(0, 5),
    actionLine: map.actionLine,
    view: map.kpis.combinedView,
    gateWord: GATE_WORD[item.row.riskGate],
    gateTone: item.row.riskGate === "vetoed" ? "destructive" : "success",
    runId: item.runId,
  }
}

/** The left-rail list for today, in display order. */
export const TODAY_DECISIONS: TodayRailItem[] = TODAY_ITEMS.map(railItem)

/** The default (top) decision id shown when the URL carries no selection. */
export const DEFAULT_TODAY_ID = TODAY_ITEMS[0]!.row.decisionId

const TODAY_BY_ID: Record<string, TodayItem> = Object.fromEntries(
  TODAY_ITEMS.map((item) => [item.row.decisionId, item])
)

/** The decision map for a today-list decision id, or `undefined`. */
export function getTodayDecisionMap(decisionId: string): DecisionMap | undefined {
  const item = TODAY_BY_ID[decisionId]
  if (!item) return undefined
  return buildDecisionMap(item.row, item.runId)
}

/* ------------------------------------------------------------------ */
/* Per-run decision maps (the /runs/[id]/decisions/[decisionId] route) */
/* ------------------------------------------------------------------ */

const ROW_BY_ID: Record<string, DecisionLogRow> = Object.fromEntries(
  DECISION_LOG.map((row) => [row.decisionId, row])
)

/**
 * The decision map for a decision id under a given run, or `undefined` if the
 * decision id is not a fixture decision (so the route can `notFound()`).
 */
export function getDecisionMap(
  decisionId: string,
  runId: string
): DecisionMap | undefined {
  const row = ROW_BY_ID[decisionId]
  if (!row) return undefined
  return buildDecisionMap(row, runId)
}

/** Every fixture decision id — for static generation. */
export const DECISION_MAP_IDS: string[] = DECISION_LOG.map((row) => row.decisionId)
