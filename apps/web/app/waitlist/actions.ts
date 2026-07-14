"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * The waitlist form's server-action result. `idle` is the initial state; a
 * successful insert (or a duplicate, which we treat as success) returns
 * `success`; validation and infrastructure failures return `error`. A `field`
 * on an error means it belongs next to that input; without one it's a generic
 * form-level failure. Raw Supabase/Postgres errors are never surfaced.
 */
export type WaitlistState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; field?: "email" }

// Permissive shape check only — the DB has its own format check + unique index,
// and over-strict client regexes reject valid addresses. Real validation is the
// column constraint.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Known entry points. Anything else is normalized to "landing" so a crafted
// query param can't write arbitrary source strings.
const SOURCES = new Set(["landing", "demo-sidebar"])

const GENERIC_ERROR = "Something went wrong. Please try again."

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const rawSource = String(formData.get("source") ?? "landing")
  const source = SOURCES.has(rawSource) ? rawSource : "landing"

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return {
      status: "error",
      field: "email",
      message: "Enter a valid email address.",
    }
  }

  // Fail soft when Supabase isn't configured (e.g. missing local env) rather
  // than throwing an unhandled error into the action.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { status: "error", message: GENERIC_ERROR }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from("waitlist").insert({ email, source })

    if (error) {
      // 23505 = unique_violation → already signed up. Same outcome for the
      // user (they're on the list), so treat it as success and don't leak
      // whether an address is already registered.
      if (error.code === "23505") {
        return { status: "success", message: "You're already on the list." }
      }
      return { status: "error", message: GENERIC_ERROR }
    }

    return { status: "success", message: "You're on the list." }
  } catch {
    return { status: "error", message: GENERIC_ERROR }
  }
}
