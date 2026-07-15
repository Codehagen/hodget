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
