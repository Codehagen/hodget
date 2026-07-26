import "server-only"

import { createHash } from "node:crypto"

import { hitRateLimit, insertWaitlistEmail as insertRow } from "@workspace/db"

import { getDb } from "./db"

/**
 * Waitlist writes — a DELIBERATELY PUBLIC surface, unlike the rest of the
 * DAL: joining the waitlist happens before any account exists, so there is
 * no session to validate. This module is NOT re-exported from lib/dal/index
 * (whose contract is "every export validates the session"); it documents its
 * own boundary instead: insert-only, validated input, generic errors.
 *
 * Confidentiality used to rest on an RLS policy, because the table was written
 * from the browser-issued Supabase anon key. It is now written server-side over
 * the pooled connection, so there is no public credential to constrain and no
 * public endpoint on the table — being unreachable from outside this module is
 * the control (see packages/db/migrations/0003_waitlist.sql).
 */
export type WaitlistInsertResult =
  | { ok: true; duplicate: boolean }
  | { ok: false }

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5

/**
 * Hash an IP into an opaque counting key.
 *
 * The raw address never reaches the database. IP addresses are personal data,
 * the audience is largely EU, and a counter needs an identifier — not an
 * identity. SHA-256 of the address alone is not irreversible (the IPv4 space is
 * small enough to enumerate), so treat these as pseudonymous, not anonymous:
 * they are short-lived by construction, since `hitRateLimit` prunes rows once
 * their window has passed.
 */
export function bucketForIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex")
}

/**
 * Per-IP rate limit, shared across every process pointed at the database
 * (plan 022). Replaced an in-memory Map that bounded a single serverless
 * instance rather than the system.
 *
 * Fails **open**: if the limiter query throws, the database is in trouble and
 * the insert this guards is about to fail anyway. A limiter outage must not be
 * able to close the signup form.
 */
export async function allowWaitlistAttempt(
  bucket: string,
  now?: Date
): Promise<boolean> {
  try {
    const { allowed } = await hitRateLimit(getDb(), {
      bucket,
      windowMs: WINDOW_MS,
      max: MAX_PER_WINDOW,
      now,
    })
    return allowed
  } catch {
    return true
  }
}

export async function insertWaitlistEmail(
  email: string,
  source: string
): Promise<WaitlistInsertResult> {
  try {
    // A duplicate is absorbed by `on conflict do nothing` in the query, so the
    // only way out of here with ok:false is a genuine infrastructure failure.
    const { inserted } = await insertRow(getDb(), { email, source })
    return { ok: true, duplicate: !inserted }
  } catch {
    return { ok: false }
  }
}
