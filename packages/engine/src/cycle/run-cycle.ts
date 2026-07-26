import type { MarketData } from "../data/market-data.js"
import { construct, type ConstructionConfig, type ConstructionContext } from "../portfolio/construct.js"
import { sizeOrders, type SizingContext } from "../portfolio/size.js"
import type { GateAction, RiskContext, RiskEngine } from "../risk/gates.js"
import type { Analyst, Broker, Committee, Fill, Order, Signal, TargetView, TargetWeight } from "../types.js"
import type { Ledger } from "../ledger/ledger.js"

/**
 * `runCycle` — the single decision kernel (plan 002 phase 4).
 *
 * One pipeline, shared byte-for-byte by all three modes (backtest, paper, live):
 *
 *   panel.predict → committee.combine → construct → sizeOrders → risk.apply
 *
 * What differs per mode is the **shell** around it — the clock and the broker's
 * execution machinery — never the kernel. The backtest drives {@link decideCycle}
 * on a historical clock and settles fills next-session; paper/live drive the same
 * {@link decideCycle} and submit through a live broker. Because the decision is a
 * pure function of `(asOf, securities, data, book contexts)`, a backtest and a
 * sim-live run over the same day produce byte-identical decisions.
 *
 * `decideCycle` is the pure decision (through risk gating). `runCycle` wraps it
 * with broker execution, ledger recording, and fills — the executing form.
 */

/** The kernel's per-cycle decision, before any execution. */
export interface CycleDecision {
  readonly asOf: string
  readonly securityIds: readonly string[]
  /** Every analyst signal, including abstentions (auditability). */
  readonly signals: Signal[]
  readonly views: TargetView[]
  readonly targetWeights: TargetWeight[]
  /** Orders that survived risk gating. */
  readonly orders: Order[]
  readonly gateActions: GateAction[]
}

/** A decision plus the fills it produced when executed. */
export interface CycleResult extends CycleDecision {
  readonly fills: Fill[]
}

/** Pure inputs to a single decision — the book-derived contexts are pre-built. */
export interface DecideCycleInput {
  readonly asOf: string
  readonly securityIds: readonly string[]
  readonly data: MarketData
  readonly panel: readonly Analyst[]
  readonly committee: Committee
  readonly construction: ConstructionContext
  readonly constructionConfig?: ConstructionConfig
  readonly sizing: SizingContext
  readonly risk: RiskEngine
  readonly riskContext: RiskContext
}

/**
 * Run the decision pipeline for one cutoff. Deterministic and side-effect free:
 * the same inputs always yield the same decision, independent of analyst or
 * security ordering (every stage re-sorts by securityId).
 */
export async function decideCycle(input: DecideCycleInput): Promise<CycleDecision> {
  const { asOf, securityIds, data, panel } = input

  const perAnalyst = await Promise.all(
    panel.map((analyst) =>
      Promise.all(securityIds.map((securityId) => analyst.predict({ securityId, asOf, data }))),
    ),
  )
  // Canonicalize signal order by (securityId, analystId): the committee blend is
  // order-independent, so this leaves views/orders untouched but makes the recorded
  // decision — and thus the ledger — independent of panel and security ordering.
  const signals = perAnalyst.flat().sort((a, b) =>
    a.securityId < b.securityId
      ? -1
      : a.securityId > b.securityId
        ? 1
        : a.analystId < b.analystId
          ? -1
          : a.analystId > b.analystId
            ? 1
            : 0,
  )

  const views = input.committee.combine(signals)
  const targetWeights = construct(views, input.construction, input.constructionConfig)
  const sized = sizeOrders(targetWeights, input.sizing)
  const { orders, actions } = input.risk.apply(sized, input.riskContext)

  return { asOf, securityIds: [...securityIds], signals, views, targetWeights, orders, gateActions: actions }
}

/**
 * A per-cycle clock: the decision cutoff, the securities in scope this cycle, and
 * where an order for a given security would settle. The historical (backtest) and
 * sim-live clocks differ only in how they derive these — the kernel cannot tell
 * them apart.
 */
export interface CycleClock {
  /** The decision-cutoff timestamp facts are scoped to. */
  asOf(): string
  /** Securities decidable this cycle (e.g. those whose exchange traded today). */
  activeSecurities(): readonly string[]
  /** Where an order for `securityId` settles (its next session), or null. */
  fillDate(securityId: string): string | null
}

export interface RunCycleDeps {
  readonly clock: CycleClock
  readonly data: MarketData
  readonly panel: readonly Analyst[]
  readonly committee: Committee
  readonly construction: ConstructionContext
  readonly constructionConfig?: ConstructionConfig
  readonly sizing: SizingContext
  readonly risk: RiskEngine
  readonly riskContext: RiskContext
  readonly broker: Broker
  readonly ledger?: Ledger
}

/**
 * The executing kernel: decide, then submit each order to the broker at its
 * settlement date, record the decision + fills to the ledger, and return both.
 * Orders whose `fillDate` is null (no next session) are not submitted.
 */
export async function runCycle(deps: RunCycleDeps): Promise<CycleResult> {
  const decision = await decideCycle({
    asOf: deps.clock.asOf(),
    securityIds: deps.clock.activeSecurities(),
    data: deps.data,
    panel: deps.panel,
    committee: deps.committee,
    construction: deps.construction,
    ...(deps.constructionConfig !== undefined ? { constructionConfig: deps.constructionConfig } : {}),
    sizing: deps.sizing,
    risk: deps.risk,
    riskContext: deps.riskContext,
  })

  // Group orders by settlement date so each broker.execute call is a single session.
  const byFillDate = new Map<string, Order[]>()
  for (const order of decision.orders) {
    const fillDate = deps.clock.fillDate(order.securityId)
    if (fillDate === null) continue
    const list = byFillDate.get(fillDate) ?? []
    list.push(order)
    byFillDate.set(fillDate, list)
  }

  const fills: Fill[] = []
  for (const fillDate of [...byFillDate.keys()].sort()) {
    const orders = byFillDate.get(fillDate) as Order[]
    fills.push(...(await deps.broker.execute(orders, fillDate)))
  }

  deps.ledger?.record({
    asOf: decision.asOf,
    signals: decision.signals,
    views: decision.views,
    targetWeights: decision.targetWeights,
    orders: decision.orders,
    gateActions: decision.gateActions,
    fills,
  })

  return { ...decision, fills }
}
