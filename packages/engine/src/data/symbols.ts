import { z } from "zod"

/**
 * Canonical symbol model: `{ symbol, mic }` using ISO 10383 MIC codes.
 *
 * Everything internal references an opaque `securityId` (a string) issued by a
 * resolver, so that a real security master with validity intervals can slot in
 * later without touching engine code (plan 003). Today the resolver is a 1:1
 * wrapper over `{ symbol, mic }`.
 */

export const micSchema = z.enum(["XNAS", "XNYS", "XOSL"])
export type Mic = z.infer<typeof micSchema>

export interface SecurityRef {
  readonly symbol: string
  readonly mic: Mic
}

export interface SecurityRegistration extends SecurityRef {
  readonly securityId: string
}

export interface SecurityResolver {
  /** Map an opaque securityId back to its `{ symbol, mic }`, or null if unknown. */
  resolve(securityId: string): SecurityRef | null
  /** Issue the securityId for a `{ symbol, mic }`. */
  idFor(ref: SecurityRef): string
}

const EXCHANGE_TIMEZONE: Record<Mic, string> = {
  XNAS: "America/New_York",
  XNYS: "America/New_York",
  XOSL: "Europe/Oslo",
}

/** IANA timezone for an exchange — used for end-of-day `knownAt` coercion. */
export function micTimeZone(mic: Mic): string {
  return EXCHANGE_TIMEZONE[mic]
}

function isMic(value: string): value is Mic {
  return micSchema.safeParse(value).success
}

const ENCODED_ID = /^([A-Z]{4}):(.+)$/

/**
 * A resolver backed by an explicit registration list. Unregistered ids fall
 * back to the encoded `MIC:SYMBOL` form so ad-hoc references still resolve.
 */
export function createSecurityResolver(
  registrations: readonly SecurityRegistration[] = [],
): SecurityResolver {
  const byId = new Map<string, SecurityRef>()
  for (const r of registrations) {
    byId.set(r.securityId, { symbol: r.symbol, mic: r.mic })
  }
  return {
    resolve(securityId) {
      const found = byId.get(securityId)
      if (found) return found
      const m = ENCODED_ID.exec(securityId)
      if (m && m[1] && m[2] && isMic(m[1])) {
        return { symbol: m[2], mic: m[1] }
      }
      return null
    },
    idFor(ref) {
      return `${ref.mic}:${ref.symbol}`
    },
  }
}
