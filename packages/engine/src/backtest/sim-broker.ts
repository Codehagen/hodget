import type { Broker, Fill, Order } from "../types.js"
import type { Currency } from "../data/types.js"
import type { Book } from "./book.js"
import type { MarketPrices } from "./pricebook.js"

/**
 * The simulated broker (plan 002, "Execution costs"). Fills orders at a given
 * session's **raw close**, applying:
 *
 * - **slippage** — `slippageBps` of the close, always worsening the fill (buys
 *   pay up, sells receive less); zero-cost fills flatter high-turnover strategies.
 * - **commission** — a flat `commissionPerTrade` in the traded currency.
 * - **per-currency cash constraint** — a buy is clipped to whole shares the book
 *   can actually fund; cash never goes negative.
 * - **cross-currency funding** — when a buy needs a currency the book is short
 *   of, cash is converted from the base currency at the PIT FX rate plus an
 *   `fxSpreadBps` spread (a modelled cost).
 *
 * The engine passes the **next** session as `fillDate`, so a decision formed
 * after the close never fills same-bar. Realised slippage, commission, and
 * spread are accumulated (in base currency) for the report's cost drag.
 */
export interface SimBrokerCosts {
  /** Flat commission per trade, in the traded currency. Default 1. */
  readonly commissionPerTrade?: number
  /** Slippage as bps of the close, worsening the fill. Default 5. */
  readonly slippageBps?: number
  /** Spread (bps) charged when funding a buy across currencies. Default 10. */
  readonly fxSpreadBps?: number
}

type ResolvedCosts = Required<SimBrokerCosts>

function resolveCosts(costs: SimBrokerCosts): ResolvedCosts {
  return {
    commissionPerTrade: costs.commissionPerTrade ?? 1,
    slippageBps: costs.slippageBps ?? 5,
    fxSpreadBps: costs.fxSpreadBps ?? 10,
  }
}

export interface SimBrokerOptions {
  readonly book: Book
  readonly prices: MarketPrices
  readonly baseCurrency: Currency
  readonly costs?: SimBrokerCosts
  /** Called after each applied fill — lets the loop assert the book invariant. */
  readonly onFill?: (fill: Fill, book: Book) => void
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** The sim broker: fills at a session close, mutating the shared {@link Book}. */
export class SimBroker implements Broker {
  private readonly book: Book
  private readonly prices: MarketPrices
  private readonly baseCurrency: Currency
  private readonly costs: ResolvedCosts
  private readonly onFill: ((fill: Fill, book: Book) => void) | undefined
  private _costsBase = 0
  private _tradedNotionalBase = 0

  constructor(options: SimBrokerOptions) {
    this.book = options.book
    this.prices = options.prices
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

  async execute(orders: readonly Order[], fillDate: string): Promise<Fill[]> {
    const fills: Fill[] = []
    for (const order of orders) {
      const fill = this.fillOne(order, fillDate)
      if (!fill) continue
      fills.push(fill)
      this.onFill?.(fill, this.book)
    }
    return fills
  }

  private fillOne(order: Order, fillDate: string): Fill | null {
    const { securityId, side } = order
    const rawClose = this.prices.closeOn(securityId, fillDate)
    if (rawClose === null) return null // symbol did not trade this session

    const currency = this.prices.currencyOf(securityId)
    const rateToBase = this.prices.rateToBase(currency, fillDate)
    const slip = this.costs.slippageBps / 10_000
    const fillPrice = side === "buy" ? rawClose * (1 + slip) : rawClose * (1 - slip)
    const commission = this.costs.commissionPerTrade

    const quantity = side === "buy"
      ? this.fillBuy(order, fillPrice, commission, currency, rateToBase)
      : this.fillSell(order, fillPrice, commission, currency)
    if (quantity <= 0) return null

    // Cost drag: slippage (vs raw close) + commission, converted to base.
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
    // Base cost to acquire one unit of `currency`, spread included.
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
