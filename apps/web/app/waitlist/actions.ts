"use server"

import { headers } from "next/headers"

import {
  allowWaitlistAttempt,
  bucketForIp,
  insertWaitlistEmail,
} from "@/lib/dal/waitlist"

/**
 * The waitlist form's server-action result. `idle` is the initial state; a
 * successful insert (or a duplicate, which we treat as success) returns
 * `success`; validation and infrastructure failures return `error`. A `field`
 * on an error means it belongs next to that input; without one it's a generic
 * form-level failure. Raw Postgres errors are never surfaced.
 */
export type WaitlistState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; field?: "email" }

// Deliberately permissive — over-strict email regexes reject valid addresses.
// The same shape is enforced as a column CHECK (migration 0004), so a write
// that bypasses this action still cannot store a malformed address; keep the
// two in sync when either changes.
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

  // BOT GATE DISABLED — see plan 022's "Deployed and reverted" note.
  //
  // `checkBotId()` verifies a proof that the client half (initBotId, wired in
  // instrumentation-client.ts) attaches. In the production build that client
  // code never reached the browser: none of the 10 chunks /waitlist loads
  // contain the BotID SDK. With no proof to verify, checkBotId classified every
  // submission as a bot and the form rejected real users silently — the worst
  // possible failure for the one conversion point before launch.
  //
  // The server-side wiring (dependency, withBotId rewrites — verified live and
  // returning 200) stays in place so re-enabling is this one call again, once
  // the client half is confirmed to load in a production build.

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return {
      status: "error",
      field: "email",
      message: "Enter a valid email address.",
    }
  }

  // Per-IP rate limit, shared across instances via Postgres (plan 022). The
  // response is the same generic error as any other failure so the limiter is
  // not observable. Vercel overwrites x-forwarded-for and does not forward
  // external values, so the first entry is the real client and cannot be
  // spoofed by the caller.
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  if (!(await allowWaitlistAttempt(bucketForIp(ip)))) {
    return { status: "error", message: GENERIC_ERROR }
  }

  // Fail soft when the database isn't configured (e.g. missing local env)
  // rather than throwing an unhandled error into the action.
  if (!process.env.DATABASE_URL) {
    return { status: "error", message: GENERIC_ERROR }
  }

  try {
    const result = await insertWaitlistEmail(email, source)
    if (!result.ok) {
      return { status: "error", message: GENERIC_ERROR }
    }
    // One message for both outcomes, deliberately. A distinct "you're already
    // on the list" would let anyone test whether a given address had signed up
    // — submit a list of names, read which ones come back "already". The user
    // is on the list either way, so nothing is lost by saying only that.
    return { status: "success", message: "You're on the list." }
  } catch {
    return { status: "error", message: GENERIC_ERROR }
  }
}
