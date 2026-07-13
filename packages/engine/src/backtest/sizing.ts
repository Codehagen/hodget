import type { Currency } from "../data/types.js"
import type { Order, Signal } from "../types.js"

/**
 * Phase-3 sizing: a deliberately **simple** conviction-proportional target
 * weight with hard caps (plan 002 phase-3 scope note). A committee view of 0.9
 * and one of 0.1 must not size the same — magnitude scales the target — and no
 * position may exceed `maxPositionPct` of equity nor the book exceed
 * `maxGrossExposure` gross. Phase 4's construction pipeline replaces this rule
 * behind the same order-producing interface, so the engine loop is untouched.
 *
 * Long-only in phase 3 (the book models no shorts): a non-positive conviction
 * targets a zero weight, so a genuine neutral view (conviction 0, not abstained)
 * sells to flat while an **abstention produces no order at all** — the book is
 * left exactly as it was.
 */
export interface SizingCaps {
  /** Max fraction of equity in any one position. Default 0.2. */
  readonly maxPositionPct?: number
  /** Max total gross exposure as a fraction of equity. Default 1. */
  readonly maxGrossExposure?: number
}

export interface SizingContext {
  /** Current total book equity in base currency. */
  readonly equityBase: number
  /** Raw mark price for a security, in its own currency (carry-forward). */
  markPrice(securityId: string): number | null
  /** Multiplier from a currency to the base currency. */
  rateToBase(currency: Currency): number
  currencyOf(securityId: string): Currency
  /** Whole shares currently held (0 if none). */
  heldQuantity(securityId: string): number
}

type ResolvedCaps = Required<SizingCaps>

function resolveCaps(caps: SizingCaps): ResolvedCaps {
  return {
    maxPositionPct: caps.maxPositionPct ?? 0.2,
    maxGrossExposure: caps.maxGrossExposure ?? 1,
  }
}

interface Target {
  readonly securityId: string
  readonly weight: number
}

function orderBy(a: Order, b: Order): number {
  // Sells before buys (free cash first), then by security for determinism.
  if (a.side !== b.side) return a.side === "sell" ? -1 : 1
  return a.securityId < b.securityId ? -1 : a.securityId > b.securityId ? 1 : 0
}

/**
 * Turn per-security signals into order intents against the current book. Only
 * actionable (non-abstained) signals produce a target; each is capped at
 * `maxPositionPct`, then all are scaled down together if gross exceeds
 * `maxGrossExposure`.
 */
export function sizeOrders(
  signals: readonly Signal[],
  ctx: SizingContext,
  caps: SizingCaps = {},
): Order[] {
  const { maxPositionPct, maxGrossExposure } = resolveCaps(caps)

  // Conviction → capped long-only weight (last signal per security wins).
  const targets = new Map<string, Target>()
  for (const signal of signals) {
    if (signal.abstained) continue
    const weight = Math.max(0, Math.min(1, signal.conviction)) * maxPositionPct
    targets.set(signal.securityId, { securityId: signal.securityId, weight })
  }

  // Hard gross-exposure cap: scale every target down proportionally if needed.
  const gross = [...targets.values()].reduce((sum, t) => sum + t.weight, 0)
  const scale = gross > maxGrossExposure && gross > 0 ? maxGrossExposure / gross : 1

  const orders: Order[] = []
  for (const target of targets.values()) {
    const price = ctx.markPrice(target.securityId)
    if (price === null || price <= 0) continue
    const currency = ctx.currencyOf(target.securityId)
    const targetValueBase = target.weight * scale * ctx.equityBase
    const priceBase = price * ctx.rateToBase(currency)
    // Floor, never round: rounding a fractional share UP would let the position's
    // value exceed maxPositionPct (or the book exceed the gross cap). The caps are
    // hard, so the target quantity is truncated toward zero.
    const targetQty = Math.floor(targetValueBase / priceBase)
    const delta = targetQty - ctx.heldQuantity(target.securityId)
    if (delta === 0) continue
    orders.push({
      securityId: target.securityId,
      side: delta > 0 ? "buy" : "sell",
      quantity: Math.abs(delta),
      currency,
    })
  }
  return orders.sort(orderBy)
}
