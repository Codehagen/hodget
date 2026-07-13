import type { Currency } from "../data/types.js"
import type { Order } from "../types.js"
import { correlationMultiplier, volScaledCap } from "./vol.js"

/**
 * Risk gates — stage (c) of the portfolio pipeline (plan 002 phase 4).
 *
 * **Hard limits applied AFTER sizing.** These are deterministic code, not advice:
 * they clip or veto order intents and record exactly what they did, and they fire
 * even at conviction 1.0. An LLM output can never bypass them — by the time
 * orders reach this stage all judgement is spent and only arithmetic remains.
 *
 * Three limits, in order:
 * 1. **Per-name position cap.** A name's resulting position may not exceed the
 *    smaller of the flat `maxPositionPct` and the **vol-scaled × correlation**
 *    cap: realized vol buckets a base 20% cap into `[5%, 25%]`, and average
 *    pairwise correlation across held names multiplies it by `[0.7, 1.1]`. A buy
 *    that would breach the cap is clipped to the gap (or vetoed if already over).
 * 2. **Gross-exposure cap.** If total resulting gross would exceed `maxGross ×
 *    equity`, buys are scaled down (never sells) until it fits.
 *
 * Sells always pass — they only ever reduce exposure. Every clip/veto is emitted
 * as a {@link GateAction} for the decision record; the ungated orders never leave
 * this function.
 */

export interface RiskConfig {
  /** Flat hard cap on any one position, as a fraction of equity. Default 0.2. */
  readonly maxPositionPct?: number
  /** Hard cap on total gross exposure, as a fraction of equity. Default 1. */
  readonly maxGross?: number
  /** Scale the per-name cap by realized vol. Default true. */
  readonly volScaling?: boolean
  /** Scale the per-name cap by average held correlation. Default true. */
  readonly correlation?: boolean
}

export interface RiskPosition {
  readonly securityId: string
  readonly quantity: number
  readonly currency: Currency
}

export interface RiskContext {
  /** Total book equity in base currency. */
  readonly equityBase: number
  /** Raw mark price for a security in its own currency, or null if unknown. */
  markPrice(securityId: string): number | null
  rateToBase(currency: Currency): number
  /** Whole shares currently held (0 if none). */
  heldQuantity(securityId: string): number
  /** Every current holding — the gross-exposure denominator's inputs. */
  positions(): readonly RiskPosition[]
  /** Annualized realized vol from PIT history, or null when unestimable. */
  realizedVol(securityId: string): number | null
  /** Average pairwise correlation across held names, or null (< 2 names). */
  averageCorrelation(): number | null
}

export type GateName = "max-position" | "vol-scaled-position" | "max-gross"

/** An immutable record of one clip/veto a gate performed on an order. */
export interface GateAction {
  readonly gate: GateName
  readonly securityId: string
  readonly action: "clip" | "veto"
  /** Order quantity before the gate. */
  readonly before: number
  /** Order quantity after the gate (0 = vetoed). */
  readonly after: number
  readonly reason: string
}

export interface RiskDecision {
  readonly orders: Order[]
  readonly actions: GateAction[]
}

export interface RiskEngine {
  apply(orders: readonly Order[], ctx: RiskContext): RiskDecision
}

type ResolvedRisk = Required<RiskConfig>

function resolve(config: RiskConfig): ResolvedRisk {
  return {
    maxPositionPct: config.maxPositionPct ?? 0.2,
    maxGross: config.maxGross ?? 1,
    volScaling: config.volScaling ?? true,
    correlation: config.correlation ?? true,
  }
}

function orderBy(a: Order, b: Order): number {
  if (a.side !== b.side) return a.side === "sell" ? -1 : 1
  return a.securityId < b.securityId ? -1 : a.securityId > b.securityId ? 1 : 0
}

/** Build a risk engine over a set of hard limits. */
export function createRiskEngine(config: RiskConfig = {}): RiskEngine {
  const cfg = resolve(config)

  return {
    apply(orders, ctx) {
      const actions: GateAction[] = []
      const priceBaseOf = (securityId: string, currency: Currency): number | null => {
        const price = ctx.markPrice(securityId)
        if (price === null || price <= 0) return null
        return price * ctx.rateToBase(currency)
      }

      // 1. Per-name position cap (vol-scaled × correlation, bounded by the flat cap).
      const corrMult = cfg.correlation ? correlationMultiplier(ctx.averageCorrelation()) : 1
      const afterPosition: Order[] = []
      for (const order of orders) {
        if (order.side === "sell") {
          afterPosition.push(order)
          continue
        }
        const priceBase = priceBaseOf(order.securityId, order.currency)
        if (priceBase === null) {
          afterPosition.push(order)
          continue
        }
        const volCap = cfg.volScaling
          ? volScaledCap(ctx.realizedVol(order.securityId), cfg.maxPositionPct)
          : cfg.maxPositionPct
        const dynamicCap = volCap * corrMult
        const effectiveCap = Math.min(cfg.maxPositionPct, dynamicCap)
        const maxPos = Math.floor((effectiveCap * ctx.equityBase) / priceBase)
        const held = ctx.heldQuantity(order.securityId)
        const resulting = held + order.quantity
        if (resulting <= maxPos) {
          afterPosition.push(order)
          continue
        }
        const gate: GateName = dynamicCap < cfg.maxPositionPct ? "vol-scaled-position" : "max-position"
        const newQty = maxPos - held
        const reason = `resulting position ${resulting} exceeds cap ${maxPos} (${(effectiveCap * 100).toFixed(2)}% of equity)`
        if (newQty <= 0) {
          actions.push({ gate, securityId: order.securityId, action: "veto", before: order.quantity, after: 0, reason })
          continue
        }
        actions.push({ gate, securityId: order.securityId, action: "clip", before: order.quantity, after: newQty, reason })
        afterPosition.push({ ...order, quantity: newQty })
      }

      // 2. Gross-exposure cap: scale buys down until total resulting gross fits.
      const gated = applyGrossCap(afterPosition, ctx, cfg, priceBaseOf, actions)

      return { orders: gated.sort(orderBy), actions }
    },
  }
}

function applyGrossCap(
  orders: readonly Order[],
  ctx: RiskContext,
  cfg: ResolvedRisk,
  priceBaseOf: (securityId: string, currency: Currency) => number | null,
  actions: GateAction[],
): Order[] {
  // Resulting quantities: current holdings adjusted by the (already position-capped) orders.
  const resulting = new Map<string, { quantity: number; currency: Currency }>()
  for (const p of ctx.positions()) resulting.set(p.securityId, { quantity: p.quantity, currency: p.currency })
  for (const order of orders) {
    const prev = resulting.get(order.securityId)?.quantity ?? 0
    const delta = order.side === "buy" ? order.quantity : -order.quantity
    resulting.set(order.securityId, { quantity: prev + delta, currency: order.currency })
  }

  let grossValue = 0
  for (const [securityId, pos] of resulting) {
    const priceBase = priceBaseOf(securityId, pos.currency)
    if (priceBase !== null) grossValue += Math.max(0, pos.quantity) * priceBase
  }

  const cap = cfg.maxGross * ctx.equityBase
  const buys = orders.filter((o) => o.side === "buy")
  const totalBuyValue = buys.reduce((sum, o) => {
    const priceBase = priceBaseOf(o.securityId, o.currency)
    return sum + (priceBase !== null ? o.quantity * priceBase : 0)
  }, 0)
  if (grossValue <= cap || totalBuyValue <= 0) return [...orders]

  // Flooring is conservative: it removes at least the excess, so gross ends ≤ cap.
  const excess = grossValue - cap
  const scale = Math.max(0, (totalBuyValue - excess) / totalBuyValue)

  const out: Order[] = []
  for (const order of orders) {
    if (order.side === "sell") {
      out.push(order)
      continue
    }
    const priceBase = priceBaseOf(order.securityId, order.currency)
    if (priceBase === null) {
      out.push(order)
      continue
    }
    const newQty = Math.floor(order.quantity * scale)
    if (newQty === order.quantity) {
      out.push(order)
      continue
    }
    const reason = `gross exposure ${grossValue.toFixed(2)} exceeds cap ${cap.toFixed(2)}`
    if (newQty <= 0) {
      actions.push({ gate: "max-gross", securityId: order.securityId, action: "veto", before: order.quantity, after: 0, reason })
      continue
    }
    actions.push({ gate: "max-gross", securityId: order.securityId, action: "clip", before: order.quantity, after: newQty, reason })
    out.push({ ...order, quantity: newQty })
  }
  return out
}
