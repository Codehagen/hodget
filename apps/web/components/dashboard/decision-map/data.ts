/**
 * Decision-map fixture — the node-graph model behind the Decision map page.
 *
 * Every map is DERIVED from a single `DECISION_LOG` row (the same rows the
 * run-detail decision log reads), so the map's header and its nodes can never
 * disagree: a Clipped row draws a clipped risk gate with matching target
 * weights, a "No trade" row draws no execution fill. The one flagship decision
 * shown in the product mock (`dec_c12f8b7a`, NVDA) matches its values exactly;
 * every other decision id renders a consistent map from the same derivation.
 *
 * Pure and deterministic — no `Date.now()`/`Math.random()` — so the /demo
 * routes prerender cleanly and server and client agree byte-for-byte. Layout
 * (x/y positions, edges) lives in `layout.ts`; this file is the domain model.
 */

import type { AnalystKind, DecisionLogRow, DecisionResult, RunMode } from "../demo-data"
import { DECISION_LOG, getRunById } from "../demo-data"

/* ------------------------------------------------------------------ */
/* Node data shapes                                                    */
/* ------------------------------------------------------------------ */

export type EvidenceItem = { title: string; time: string; source: string }

export type DataSourceNodeData = {
  ticker: string
  /** Known-at cutoff, e.g. "2025-05-15 13:50 UTC". */
  cutoff: string
  sources: { label: string; ok: boolean }[]
  state: string
}

export type AnalystViewNodeData = {
  analystId: string
  name: string
  kind: AnalystKind
  version: string
  conviction: number
  horizonDays: number
  thesis: string
  weight: number
  /** Included in the committee blend, or excluded (e.g. different horizon). */
  included: boolean
  excludedReason?: string
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
  included: CommitteeContributor[]
  excluded: CommitteeExcluded[]
  netView: number
  /** Included views, for the agreement strip. */
  agreement: number[]
  /** Excluded views, for the dissent strip. */
  dissent: number[]
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
  timeline: string
  ledgerId: string
}

export type DecisionMap = {
  id: string
  ticker: string
  timestamp: string
  mode: RunMode
  executed: boolean
  runId: string
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
  /** Null when nothing was executed (a no-trade decision). */
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

// Per-ticker thesis lines (kept consistent with the demo-data DECISION_NOTES
// vocabulary) so an analyst's card + inspector read the same story.
const THESIS: Record<string, [string, string, string]> = {
  NVDA: [
    "Undervalued vs peers; robust FCF and margin expansion.",
    "Upward estimate revisions; improving guidance quality.",
    "Rate pressure on multiples; growth slowdown risk.",
  ],
  AAPL: [
    "Trades near fair value with a durable services mix.",
    "Steady positive revisions after the print.",
    "Consumer softness is a modest headwind.",
  ],
  EQNR: [
    "Cash returns and buyback underpin the valuation.",
    "Positive revisions on firmer Brent.",
    "Energy tailwind from tighter supply.",
  ],
  DNB: [
    "Cheap on book, but the credit cycle is turning.",
    "Estimate revisions flat to lower.",
    "Rate-sensitive; spreads widening.",
  ],
}

// Exact inspector evidence for the flagship NVDA decision (matches the mock).
// Other decisions derive a single evidence item from the analyst's thesis.
const FLAGSHIP_EVIDENCE: Record<string, EvidenceItem[]> = {
  value: [
    { title: "FCF yield vs peers in bottom quartile", time: "2025-05-15 13:31 UTC", source: "Fundamentals" },
    { title: "Consensus EPS revisions up 4.2% (60d) vs sector", time: "2025-05-15 13:22 UTC", source: "Estimates" },
    { title: "Gross margin expansion +220bps (TTM)", time: "2025-05-15 13:18 UTC", source: "Fundamentals" },
  ],
  "earnings-drift": [
    { title: "Standardized earnings surprise +2.1σ", time: "2025-05-15 13:29 UTC", source: "Estimates" },
    { title: "Post-announcement drift window still open (10d)", time: "2025-05-15 13:24 UTC", source: "Prices" },
  ],
  "macro-context": [
    { title: "Real-rate path steepening on the 21-day horizon", time: "2025-05-15 13:20 UTC", source: "Macro" },
    { title: "Multiple compression risk into a data-heavy window", time: "2025-05-15 13:14 UTC", source: "Macro" },
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
      horizonDays: meta.horizonDays,
      thesis,
      weight: meta.weight,
      included,
      excludedReason: included ? undefined : "different horizon",
      evidence,
      renderedContext,
      prompt: meta.prompt,
      model: meta.model,
      parseVerified: true,
    }
  })
}

function buildDecisionMap(row: DecisionLogRow, runId: string): DecisionMap {
  const analysts = buildAnalysts(row)
  const included = analysts.filter((a) => a.included)
  const excluded = analysts.filter((a) => !a.included)

  const noTrade = row.nextSessionFill === "No trade"
  const clipped = row.riskGate === "clipped"
  const fill = parseFill(row.nextSessionFill)
  const side: Side = fill?.side ?? (row.committeeView >= 0 ? "BUY" : "SELL")

  // A clipped gate reduces a proposed weight down to the row's target; a passed
  // gate leaves it. The proposed size scales with the pre-clip weight, so the
  // construction and execution sizes stay in proportion (e.g. 412 @ 6.00% →
  // 584 @ 8.50% for the flagship).
  const toPct = row.targetWeight
  const fromPct = clipped ? row.targetWeight + 2.5 : row.targetWeight
  const approvedSize = fill?.qty ?? 0
  const proposedSize =
    fromPct > 0 && toPct > 0 ? Math.round((approvedSize * fromPct) / toPct) : approvedSize

  const construction: ConstructionNodeData | null =
    noTrade || !fill
      ? null
      : { proposedTargetPct: fromPct, side, size: proposedSize }

  const risk: RiskGateNodeData = clipped
    ? {
        result: "clipped",
        reason: "Concentration cap",
        fromPct,
        toPct,
        approvedSide: side,
        approvedSize,
      }
    : noTrade
      ? {
          result: "passed",
          reason: "Below entry threshold",
          fromPct: 0,
          toPct: 0,
          approvedSide: side,
          approvedSize: 0,
        }
      : {
          result: "passed",
          reason: "Within concentration and gross-exposure limits",
          fromPct: toPct,
          toPct,
          approvedSide: side,
          approvedSize,
        }

  const execution: ExecutionNodeData | null =
    noTrade || !fill
      ? null
      : {
          filled: true,
          status: "FILLED",
          side: fill.side,
          qty: fill.qty,
          price: fill.price,
          timeline: `Next-session open · ${nextTradingDay(row.date)}`,
          ledgerId: row.decisionId === FLAGSHIP_ID ? "fill_72a91c" : `fill_${hex6(row.decisionId)}`,
        }

  const run = getRunById(runId)

  return {
    id: row.decisionId,
    ticker: row.ticker,
    timestamp: `${row.date} ${row.time} UTC`,
    mode: run?.mode ?? "backtest",
    executed: !noTrade,
    runId,
    provenance: {
      dataset: "ds_9a7e52b1",
      panel: "value-panel@v3.2.1",
      deterministicReplay: true,
    },
    data: {
      ticker: row.ticker,
      cutoff: `${row.date} 13:50 UTC`,
      sources: [
        { label: "Fundamentals", ok: true },
        { label: "Estimates", ok: true },
        { label: "Prices", ok: true },
      ],
      state: "Verified",
    },
    analysts,
    committee: {
      dominantHorizon: `${DOMINANT_HORIZON_DAYS}d`,
      included: included.map((a) => ({ name: a.name, weight: a.weight, conviction: a.conviction })),
      excluded: excluded.map((a) => ({ name: a.name, horizon: `${a.horizonDays}d`, conviction: a.conviction })),
      netView: row.committeeView,
      agreement: included.map((a) => a.conviction),
      dissent: excluded.map((a) => a.conviction),
      method: "Weighted blend · abstentions excluded",
    },
    construction,
    risk,
    execution,
    primaryAnalystId: included[0]?.analystId ?? analysts[0]!.analystId,
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
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
