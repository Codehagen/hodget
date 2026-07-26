import type { Sql } from "../client.js"

/**
 * A fixed-window rate limiter backed by `rate_limit_hits` (plan 022).
 *
 * Shared state is the entire point: the previous limiter was a module-level Map,
 * which on serverless bounds one instance rather than the system. Every process
 * pointed at the same database now draws from one budget.
 *
 * The window is fixed, not sliding — a caller can burst across a boundary. That
 * is an accepted trade for a single atomic statement per check; sliding windows
 * need either a range scan over retained hits or a second counter, and neither
 * is worth it to stop a signup form from being spammed.
 */

export interface RateLimitResult {
  /** False once the caller has exceeded `max` within the current window. */
  readonly allowed: boolean
  /** Hits recorded in the current window, including this one. */
  readonly count: number
}

export interface HitRateLimitInput {
  /**
   * The counting key. Callers MUST pass an opaque identifier (e.g. a SHA-256
   * hash), never a raw IP address or email — this value is persisted.
   */
  readonly bucket: string
  /** Window length in milliseconds. */
  readonly windowMs: number
  /** Hits allowed per window. The `max`-th hit is allowed; `max + 1` is not. */
  readonly max: number
  /** Injectable clock for tests; defaults to now. */
  readonly now?: Date
}

/**
 * Record one hit against `bucket` and report whether it is allowed.
 *
 * The insert is a single atomic UPSERT, so concurrent requests cannot both read
 * a stale count and both decide they are under the cap — Postgres serializes
 * them on the primary key and each gets its own `hits` value back.
 */
export async function hitRateLimit(
  sql: Sql,
  input: HitRateLimitInput,
): Promise<RateLimitResult> {
  const now = input.now ?? new Date()
  // Floor to the window so every caller in the same period shares a row.
  const windowStart = new Date(
    Math.floor(now.getTime() / input.windowMs) * input.windowMs,
  )

  const rows = await sql.query<{ hits: number }>(
    `insert into rate_limit_hits (bucket, window_start, hits)
     values ($1, $2::timestamptz, 1)
     on conflict (bucket, window_start)
     do update set hits = rate_limit_hits.hits + 1
     returning hits`,
    [input.bucket, windowStart.toISOString()],
  )

  const count = Number(rows[0]?.hits ?? 1)

  // Opportunistic prune: only on the first hit of a new window, so the delete
  // runs about once per window per bucket instead of on every request. Rows are
  // useless once their window has passed; the hour of slack keeps the delete
  // rare and avoids racing a window that is still being written.
  if (count === 1) {
    await sql.query(
      `delete from rate_limit_hits where window_start < $1::timestamptz`,
      [new Date(now.getTime() - 60 * 60 * 1000).toISOString()],
    )
  }

  return { allowed: count <= input.max, count }
}
