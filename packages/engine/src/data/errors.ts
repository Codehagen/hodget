/**
 * Data-layer error taxonomy.
 *
 * The distinction is load-bearing for backtest honesty (plan 002/003):
 *
 * - {@link DataUnavailableError} — the source could not be reached or answered
 *   (network error, 5xx, rate-limit exhaustion, auth failure, poisoned
 *   transport). Callers MUST fail loud; treating this as "no data" silently
 *   corrupts every run that spanned the outage.
 * - {@link DataQualityError} — the source answered, but a row is unusable
 *   (malformed against its schema, or missing a usable `knownAt`). Silently
 *   dropping such rows thins history invisibly, so we throw instead.
 * - A genuine "this symbol has no such facts" is NOT an error: it is a
 *   `covered`-status result with an empty `rows` array (see market-data.ts).
 */

export interface DataErrorOptions {
  readonly cause?: unknown
}

export class DataUnavailableError extends Error {
  override readonly name = "DataUnavailableError"
  constructor(message: string, options?: DataErrorOptions) {
    super(message, options)
    Object.setPrototypeOf(this, DataUnavailableError.prototype)
  }
}

export class DataQualityError extends Error {
  override readonly name = "DataQualityError"
  constructor(message: string, options?: DataErrorOptions) {
    super(message, options)
    Object.setPrototypeOf(this, DataQualityError.prototype)
  }
}
