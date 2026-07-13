import { DataQualityError } from "./errors.js"

/**
 * Point-in-time timestamp handling.
 *
 * `knownAt` may arrive as a full ISO timestamp (an announcement/filing instant)
 * or as a date-only value (a provider that only gives a date). Per plan 002/003
 * a date-only value is conservatively treated as known at *end of day in the
 * exchange's timezone*, so it only becomes visible the next trading day.
 *
 * We deliberately avoid a timezone dependency: `Intl.DateTimeFormat` already
 * ships the IANA database, so a single-pass offset computation is enough for
 * an end-of-day instant (never near a DST transition boundary).
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]/

/** Parse an ISO instant to epoch milliseconds, throwing on garbage. */
export function parseInstant(value: string): number {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    throw new DataQualityError(`unparseable timestamp: ${JSON.stringify(value)}`)
  }
  return ms
}

/**
 * The UTC offset (ms) that `timeZone` was at for a given UTC instant.
 * Positive east of UTC (e.g. Europe/Oslo winter = +3_600_000).
 */
function offsetForInstant(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const f: Record<string, number> = {}
  for (const p of parts) {
    if (p.type !== "literal") f[p.type] = Number(p.value)
  }
  const asSeenUtc = Date.UTC(
    f.year ?? 0,
    (f.month ?? 1) - 1,
    f.day ?? 1,
    f.hour ?? 0,
    f.minute ?? 0,
    f.second ?? 0,
  )
  return asSeenUtc - utcMs
}

/** Convert a wall-clock time in `timeZone` to a UTC epoch (ms). */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): number {
  // Compute the offset from a clean noon instant: the offset is constant across
  // a day except at a DST transition (~02:00-03:00 local), which noon and any
  // evening wall-time both sit after — and `formatToParts` carries no ms, so a
  // second/ms-free reference keeps the arithmetic exact.
  const offset = offsetForInstant(Date.UTC(year, month - 1, day, 12, 0, 0, 0), timeZone)
  return Date.UTC(year, month - 1, day, hour, minute, second, ms) - offset
}

/** Epoch (ms) for 23:59:59.999 on `dateOnly` in `timeZone`. */
export function zonedEndOfDay(dateOnly: string, timeZone: string): number {
  const m = DATE_ONLY.exec(dateOnly)
  if (!m) {
    throw new DataQualityError(`expected a date (YYYY-MM-DD): ${JSON.stringify(dateOnly)}`)
  }
  return zonedWallTimeToUtc(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    23,
    59,
    59,
    999,
    timeZone,
  )
}

/**
 * Resolve a `knownAt` field to a comparable epoch (ms).
 *
 * - Full timestamp → parsed as-is.
 * - Date-only → end of day in `timeZone` (visible next trading day).
 * - Anything else / empty → {@link DataQualityError} (never silently dropped).
 */
export function coerceKnownAt(knownAt: string, timeZone: string): number {
  if (DATE_TIME.test(knownAt)) return parseInstant(knownAt)
  if (DATE_ONLY.test(knownAt)) return zonedEndOfDay(knownAt, timeZone)
  throw new DataQualityError(`unusable knownAt: ${JSON.stringify(knownAt)}`)
}
