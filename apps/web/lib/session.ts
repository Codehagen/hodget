import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "./auth"

/** Validates the session against the database. Use in every protected page,
 * server action and route handler — proxy.ts is not a security boundary.
 *
 * Wrapped in React's cache() so N calls within one render pass share a single
 * database round-trip. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

export const requireSession = cache(async () => {
  const session = await getSession()

  if (!session) {
    redirect("/sign-in")
  }

  return session
})
