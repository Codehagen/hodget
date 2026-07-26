import type { Currency } from "../data/types.js"
import type { Order, TargetWeight } from "../types.js"

/**
 * Sizing — stage (b) of the portfolio pipeline (plan 002 phase 4).
 *
 * Turns desired {@link TargetWeight}s into whole-share {@link Order} deltas
 * against the current book. Per-currency aware: a weight is a fraction of total
 * base-currency equity, converted to the name's own currency at the PIT FX rate
 * before dividing by its raw price.
 *
 * `Math.floor`, never round: rounding a fractional share up would let a position
 * exceed the weight it was sized to (and, in aggregate, breach the gross cap).
 * The target quantity is truncated toward zero; the delta against the current
 * holding becomes a buy or a sell. A target that already matches the holding
 * emits no order.
 *
 * This stage is pure over its context and independently testable; the risk gates
 * (stage c) clip the orders it produces.
 */

export interface SizingContext {
  /** Current total book equity in base currency. */
  readonly equityBase: number
  /** Raw mark price for a security, in its own currency (carry-forward). */
  markPrice(securityId: string): number | null
  /** Multiplier from a currency to the base currency. */
  rateToBase(currency: Currency): number
  /** Whole shares currently held (0 if none). */
  heldQuantity(securityId: string): number
}

function orderBy(a: Order, b: Order): number {
  // Sells before buys (free cash first), then by security for determinism.
  if (a.side !== b.side) return a.side === "sell" ? -1 : 1
  return a.securityId < b.securityId ? -1 : a.securityId > b.securityId ? 1 : 0
}

export function sizeOrders(weights: readonly TargetWeight[], ctx: SizingContext): Order[] {
  const orders: Order[] = []
  for (const target of weights) {
    const price = ctx.markPrice(target.securityId)
    if (price === null || price <= 0) continue
    const priceBase = price * ctx.rateToBase(target.currency)
    const targetValueBase = target.weight * ctx.equityBase
    const targetQty = Math.floor(targetValueBase / priceBase)
    const delta = targetQty - ctx.heldQuantity(target.securityId)
    if (delta === 0) continue
    orders.push({
      securityId: target.securityId,
      side: delta > 0 ? "buy" : "sell",
      quantity: Math.abs(delta),
      currency: target.currency,
    })
  }
  return orders.sort(orderBy)
}
