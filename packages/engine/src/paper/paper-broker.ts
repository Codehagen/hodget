import type { Currency } from "../data/types.js"
import type { Book } from "../backtest/book.js"
import type { MarketPrices } from "../backtest/pricebook.js"
import type { Broker, Fill, Order } from "../types.js"

/**
 * The paper broker (plan 002, phase 6) — a {@link Broker} for the **live-style
 * clock**, sharing the sim broker's cost model but not its synchronous
 * execution machinery.
 *
 * ## Contract
 *
 * A decision is formed after a session's close and may only fill at the **next
 * available close** for the symbol's exchange — never same-bar. On a historical
 * clock that next close already exists, so {@link SimBroker} fills it
 * synchronously. On a live clock the next close **has not happened yet**, so the
 * paper broker cannot fill at submission time. Instead:
 *
 * - {@link PaperBroker.execute} — the {@link Broker} entry point `runCycle`
 *   calls. It **never fills**; it records each order as a {@link PendingOrder}
 *   resting on its fill session (the `fillDate` the clock supplies, which is
 *   strictly after the decision cutoff) and returns `[]`. Returning no fills is
 *   the structural guarantee of no same-bar execution: the decision recorded at
 *   submission carries empty fills, and they are backfilled onto the ledger once
 *   the order settles.
 * - {@link PaperBroker.settle} — advances resting orders against `pricesNow`, a
 *   {@link MarketPrices} view of **what is known right now**. An order settles
 *   the first time its fill session has an available close; until then it rests.
 *   Settle is idempotent per order: a settled order leaves the queue, so a second
 *   settle with the same price never double-fills. If the fill session has no
 *   available close (it has not arrived, or the symbol did not trade), the order
 *   stays pending; if the session priced but the order cannot be funded (a buy
 *   the book's cash cannot cover, or a sell of shares no longer held), it is
 *   dropped, exactly as the sim broker drops an unfillable order.
 *
 * Callers own the point-in-time honesty of `pricesNow`: passing a price book
 * that contains sessions the live clock has not reached would fill early, the
 * execution-side analogue of lookahead. The clock and the caller keep `now`
 * ahead of no fill session.
 *
 * The cost model **mirrors {@link SimBroker}** — commission, slippage worsening
 * the fill, and cross-currency funding at the PIT FX rate plus a spread — so a
 * strategy's realised costs are consistent between a backtest and its paper run.
 * (The logic is deliberately duplicated rather than shared to keep this change
 * surgical; a future refactor could extract a single fill primitive both brokers
 * consume.)
 */
export interface PaperBrokerCosts {
  /** Flat commission per trade, in the traded currency. Default 1. */
  readonly commissionPerTrade?: number
  /** Slippage as bps of the close, worsening the fill. Default 5. */
  readonly slippageBps?: number
  /** Spread (bps) charged when funding a buy across currencies. Default 10. */
  readonly fxSpreadBps?: number
}

type ResolvedCosts = Required<PaperBrokerCosts>

function resolveCosts(costs: PaperBrokerCosts): ResolvedCosts {
  return {
    commissionPerTrade: costs.commissionPerTrade ?? 1,
    slippageBps: costs.slippageBps ?? 5,
    fxSpreadBps: costs.fxSpreadBps ?? 10,
  }
}

/** An order resting in the paper broker until its fill session prices. */
export interface PendingOrder {
  readonly order: Order
  /** The session this order must fill at — strictly after the decision cutoff. */
  readonly fillDate: string
}

export interface PaperBrokerOptions {
  readonly book: Book
  readonly baseCurrency: Currency
  readonly costs?: PaperBrokerCosts
  /** Called after each applied fill — lets a runner assert the book invariant. */
  readonly onFill?: (fill: Fill, book: Book) => void
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** The paper broker: rests orders, then settles them at the next available close. */
export class PaperBroker implements Broker {
  private readonly book: Book
  private readonly baseCurrency: Currency
  private readonly costs: ResolvedCosts
  private readonly onFill: ((fill: Fill, book: Book) => void) | undefined
  private readonly pendingOrders: PendingOrder[] = []
  private _costsBase = 0
  private _tradedNotionalBase = 0

  constructor(options: PaperBrokerOptions) {
    this.book = options.book
    this.baseCurrency = options.baseCurrency
    this.costs = resolveCosts(options.costs ?? {})
    this.onFill = options.onFill
  }

  /** Base-currency slippage + commission + FX-spread paid so far (cost drag). */
  get costsBase(): number {
    return this._costsBase
  }

  /** Gross traded notional in base currency so far (turnover numerator). */
  get tradedNotionalBase(): number {
    return this._tradedNotionalBase
  }

  /** Orders currently resting, awaiting a price for their fill session. */
  pending(): readonly PendingOrder[] {
    return this.pendingOrders
  }

  /**
   * Record orders to rest on `fillDate`. Never fills — a paper order can only
   * settle once its fill session's close is available (see {@link settle}).
   */
  async execute(orders: readonly Order[], fillDate: string): Promise<Fill[]> {
    for (const order of orders) this.pendingOrders.push({ order, fillDate })
    return []
  }

  /**
   * Settle every resting order whose fill session now has a close in `prices`.
   * A settled order leaves the queue (filled exactly once); an order whose fill
   * session has no available close stays pending; an order that priced but cannot
   * be funded is dropped. Returns the fills produced by this call.
   */
  settle(prices: MarketPrices): Fill[] {
    const fills: Fill[] = []
    const stillPending: PendingOrder[] = []
    for (const pending of this.pendingOrders) {
      const rawClose = prices.closeOn(pending.order.securityId, pending.fillDate)
      if (rawClose === null) {
        stillPending.push(pending) // fill session not yet available — keep resting
        continue
      }
      const fill = this.fillAt(pending, rawClose, prices)
      if (fill) {
        fills.push(fill)
        this.onFill?.(fill, this.book)
      }
      // A priced-but-unfundable order is resolved (dropped), never left resting.
    }
    this.pendingOrders.length = 0
    this.pendingOrders.push(...stillPending)
    return fills
  }

  private fillAt(pending: PendingOrder, rawClose: number, prices: MarketPrices): Fill | null {
    const { order, fillDate } = pending
    const { securityId, side } = order

    const currency = prices.currencyOf(securityId)
    const rateToBase = prices.rateToBase(currency, fillDate)
    const slip = this.costs.slippageBps / 10_000
    const fillPrice = side === "buy" ? rawClose * (1 + slip) : rawClose * (1 - slip)
    const commission = this.costs.commissionPerTrade

    const quantity = side === "buy"
      ? this.fillBuy(order, fillPrice, commission, currency, rateToBase)
      : this.fillSell(order, fillPrice, commission, currency)
    if (quantity <= 0) return null

    const slippageCost = quantity * Math.abs(fillPrice - rawClose)
    this._costsBase += (slippageCost + commission) * rateToBase
    this._tradedNotionalBase += quantity * fillPrice * rateToBase

    return {
      securityId,
      side,
      quantity,
      price: fillPrice,
      currency,
      filledAt: `${fillDate}T21:00:00Z`,
      commission,
    }
  }

  private fillBuy(
    order: Order,
    fillPrice: number,
    commission: number,
    currency: Currency,
    rateToBase: number,
  ): number {
    const crossCurrency = currency !== this.baseCurrency
    const effectiveBasePerUnit = rateToBase * (1 + this.costs.fxSpreadBps / 10_000)
    const baseAvailable = crossCurrency ? this.book.cash(this.baseCurrency) : 0
    const acquirableFromBase = crossCurrency ? baseAvailable / effectiveBasePerUnit : 0
    const available = this.book.cash(currency) + acquirableFromBase

    const maxQty = Math.floor((available - commission) / fillPrice)
    const quantity = Math.min(order.quantity, maxQty)
    if (quantity <= 0) return 0

    const cost = round2(quantity * fillPrice + commission)
    const held = this.book.cash(currency)
    if (crossCurrency && held < cost) {
      const deficit = round2(cost - held)
      const conversion = this.book.convert({
        from: this.baseCurrency,
        to: currency,
        amountTo: deficit,
        fromPerTo: rateToBase,
        spreadBps: this.costs.fxSpreadBps,
      })
      this._costsBase += conversion.spreadCost // already base-denominated
    }
    this.book.buy(order.securityId, quantity, fillPrice, currency, commission)
    return quantity
  }

  private fillSell(order: Order, fillPrice: number, commission: number, currency: Currency): number {
    const held = this.book.position(order.securityId)?.quantity ?? 0
    const quantity = Math.min(order.quantity, held)
    if (quantity <= 0) return 0
    this.book.sell(order.securityId, quantity, fillPrice, currency, commission)
    return quantity
  }
}
