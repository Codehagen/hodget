import "server-only"

import { createClient } from "@/lib/supabase/server"

/**
 * Waitlist writes — a DELIBERATELY PUBLIC surface, unlike the rest of the
 * DAL: joining the waitlist happens before any account exists, so there is
 * no session to validate. This module is NOT re-exported from lib/dal/index
 * (whose contract is "every export validates the session"); it documents its
 * own boundary instead: insert-only, validated input, generic errors.
 * Confidentiality of the table rests on the RLS policy (plan 009).
 */
export type WaitlistInsertResult =
  | { ok: true; duplicate: boolean }
  | { ok: false }

/**
 * Best-effort, per-instance rate limit: serverless instances don't share
 * memory, so this bounds abuse per warm instance rather than globally. The
 * global backstop is the DB unique index + RLS; platform-level limiting
 * (e.g. a WAF rule) can be layered on in ops without code changes.
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, { windowStart: number; count: number }>()

export function allowWaitlistAttempt(key: string, now = Date.now()): boolean {
  const entry = hits.get(key)
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(key, { windowStart: now, count: 1 })
    return true
  }
  entry.count += 1
  return entry.count <= MAX_PER_WINDOW
}

export async function insertWaitlistEmail(
  email: string,
  source: string
): Promise<WaitlistInsertResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("waitlist").insert({ email, source })
  if (!error) return { ok: true, duplicate: false }
  // 23505 = unique_violation → already signed up; same outcome for the user.
  if (error.code === "23505") return { ok: true, duplicate: true }
  return { ok: false }
}
