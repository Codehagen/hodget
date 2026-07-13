import type { Currency } from "../data/types.js"

/**
 * The accounting book (plan 002, "Market realities" + "Numeric policy").
 *
 * Holds **per-currency cash** and **whole-share positions**, and applies
 * corporate-action events on **raw prices** (a split mutates the share count
 * with the dropped fraction recorded; a dividend credits cash on ex-date in the
 * position's currency). Cash is rounded to the minor unit at every mutation and
 * can never go negative (a bug that would overdraw throws rather than silently
 * fabricating money). Position quantities are integers — accounting never
 * invents fractional shares.
 *
 * Research math (valuation, metrics) uses float64; only the ledger state here is
 * rounded. The invariant `cash + Σ(position × price × fx)` in base currency is
 * what {@link Book.equityInBase} computes and tests assert after every fill.
 */

const CASH_EPSILON = 1e-9

export interface Position {
  readonly quantity: number
  readonly currency: Currency
}

/** Record of a split applied to a holding — the dropped fraction is preserved. */
export interface SplitRecord {
  readonly securityId: string
  readonly ratio: number
  readonly before: number
  readonly after: number
  /** Fractional shares dropped by whole-share rounding (never fabricated). */
  readonly fractionalDropped: number
}

/** Record of a dividend credited to the book on its ex-date. */
export interface DividendRecord {
  readonly securityId: string
  readonly currency: Currency
  readonly cashCredited: number
}

/** Result of an FX conversion — costs are surfaced for cost-drag accounting. */
export interface ConversionRecord {
  readonly from: Currency
  readonly to: Currency
  readonly amountTo: number
  /** Total `from`-currency cash spent, spread included. */
  readonly costFrom: number
  /** The portion of `costFrom` attributable to the spread (a real cost). */
  readonly spreadCost: number
}

/** Valuation inputs for {@link Book.equityInBase}: raw price + FX to base. */
export interface BookValuation {
  /** Raw close for a held security, in the position's own currency. */
  markPrice(securityId: string): number
  /** Multiplier taking an amount in `currency` to the base currency. */
  rateToBase(currency: Currency): number
}

function assertInteger(quantity: number, label: string): void {
  if (!Number.isInteger(quantity)) {
    throw new Error(`${label} must be a whole number of shares, got ${quantity}`)
  }
}

export interface BookOptions {
  /** Minor-unit decimal places cash is rounded to at every mutation. Default 2. */
  readonly cashDecimals?: number
}

export class Book {
  private readonly cashByCurrency = new Map<Currency, number>()
  private readonly positionBySecurity = new Map<string, Position>()
  private readonly cashFactor: number

  constructor(initialCash: Partial<Record<Currency, number>> = {}, options: BookOptions = {}) {
    this.cashFactor = 10 ** (options.cashDecimals ?? 2)
    for (const [currency, amount] of Object.entries(initialCash) as [Currency, number][]) {
      if (amount !== undefined) this.cashByCurrency.set(currency, this.round(amount))
    }
  }

  private round(amount: number): number {
    return Math.round(amount * this.cashFactor) / this.cashFactor
  }

  cash(currency: Currency): number {
    return this.cashByCurrency.get(currency) ?? 0
  }

  /** A snapshot of every non-zero currency balance. */
  cashBalances(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [currency, amount] of this.cashByCurrency) out[currency] = amount
    return out
  }

  position(securityId: string): Position | undefined {
    return this.positionBySecurity.get(securityId)
  }

  positions(): ReadonlyMap<string, Position> {
    return this.positionBySecurity
  }

  creditCash(currency: Currency, amount: number): void {
    if (amount < 0) throw new Error(`creditCash amount must be non-negative, got ${amount}`)
    this.cashByCurrency.set(currency, this.round(this.cash(currency) + amount))
  }

  debitCash(currency: Currency, amount: number): void {
    if (amount < 0) throw new Error(`debitCash amount must be non-negative, got ${amount}`)
    const next = this.round(this.cash(currency) - amount)
    if (next < -CASH_EPSILON) {
      throw new Error(
        `debitCash would overdraw ${currency}: balance ${this.cash(currency)} − ${amount}`,
      )
    }
    this.cashByCurrency.set(currency, next < 0 ? 0 : next)
  }

  private addShares(securityId: string, quantity: number, currency: Currency): void {
    const existing = this.positionBySecurity.get(securityId)
    if (existing && existing.currency !== currency) {
      throw new Error(
        `position currency mismatch for ${securityId}: ${existing.currency} vs ${currency}`,
      )
    }
    const next = (existing?.quantity ?? 0) + quantity
    if (next === 0) this.positionBySecurity.delete(securityId)
    else this.positionBySecurity.set(securityId, { quantity: next, currency })
  }

  /** Debit cash (cost + commission) and add whole shares — a settled buy. */
  buy(securityId: string, quantity: number, price: number, currency: Currency, commission: number): void {
    assertInteger(quantity, "buy quantity")
    this.debitCash(currency, this.round(quantity * price + commission))
    this.addShares(securityId, quantity, currency)
  }

  /** Remove whole shares and credit proceeds (net of commission) — a settled sell. */
  sell(securityId: string, quantity: number, price: number, currency: Currency, commission: number): void {
    assertInteger(quantity, "sell quantity")
    const held = this.positionBySecurity.get(securityId)?.quantity ?? 0
    if (quantity > held) {
      throw new Error(`cannot sell ${quantity} of ${securityId}: only ${held} held`)
    }
    this.addShares(securityId, -quantity, currency)
    const net = this.round(quantity * price - commission)
    if (net >= 0) this.creditCash(currency, net)
    else this.debitCash(currency, -net)
  }

  /**
   * Apply a split to a held position on its ex-date. New share count is
   * `floor(quantity × ratio)`; the dropped fraction is recorded (never
   * fabricated into cash in phase 3).
   */
  applySplit(securityId: string, ratio: number): SplitRecord {
    const existing = this.positionBySecurity.get(securityId)
    const before = existing?.quantity ?? 0
    const raw = before * ratio
    const after = Math.floor(raw + CASH_EPSILON)
    if (existing) {
      if (after === 0) this.positionBySecurity.delete(securityId)
      else this.positionBySecurity.set(securityId, { quantity: after, currency: existing.currency })
    }
    return { securityId, ratio, before, after, fractionalDropped: raw - after }
  }

  /** Credit a per-share dividend on its ex-date in the position's currency. */
  applyDividend(securityId: string, amountPerShare: number, currency: Currency): DividendRecord {
    const held = this.positionBySecurity.get(securityId)?.quantity ?? 0
    const cashCredited = this.round(held * amountPerShare)
    if (cashCredited > 0) this.creditCash(currency, cashCredited)
    return { securityId, currency, cashCredited }
  }

  /**
   * Convert cash across currencies: acquire `amountTo` units of `to` by spending
   * `from` cash at a mid rate of `fromPerTo` units-of-`from`-per-`to`, worsened
   * by `spreadBps`. Used when a buy needs a currency the book is short of.
   */
  convert(args: {
    readonly from: Currency
    readonly to: Currency
    readonly amountTo: number
    readonly fromPerTo: number
    readonly spreadBps: number
  }): ConversionRecord {
    const { from, to, amountTo, fromPerTo, spreadBps } = args
    const spreadCost = amountTo * fromPerTo * (spreadBps / 10_000)
    const costFrom = this.round(amountTo * fromPerTo + spreadCost)
    this.debitCash(from, costFrom)
    this.creditCash(to, amountTo)
    return { from, to, amountTo, costFrom, spreadCost }
  }

  /**
   * Total book value in `baseCurrency`: cash across every currency plus every
   * position marked at its raw price, each converted at its FX rate to base.
   * This is the accounting invariant tests assert after each fill.
   */
  equityInBase(valuation: BookValuation, baseCurrency: Currency): number {
    let equity = 0
    for (const [currency, amount] of this.cashByCurrency) {
      equity += amount * (currency === baseCurrency ? 1 : valuation.rateToBase(currency))
    }
    for (const [securityId, position] of this.positionBySecurity) {
      const rate = position.currency === baseCurrency ? 1 : valuation.rateToBase(position.currency)
      equity += position.quantity * valuation.markPrice(securityId) * rate
    }
    return equity
  }
}
