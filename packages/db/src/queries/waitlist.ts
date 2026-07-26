import { randomUUID } from "node:crypto"

import type { Sql } from "../client.js"

/**
 * `waitlist` queries. The one table in this package that is written without a
 * session — joining the waitlist happens before any account exists. The caller
 * (`apps/web/lib/dal/waitlist.ts`) owns that boundary and documents it; this
 * module just does the insert.
 */

export interface InsertWaitlistEmailResult {
  /** False when the address was already on the list. */
  readonly inserted: boolean
}

/**
 * Add an address to the waitlist, treating a repeat signup as success.
 *
 * `on conflict do nothing` against the `lower(email)` unique index means a
 * duplicate returns zero rows instead of raising 23505, so the caller never has
 * to branch on a driver error code — and the outcome is identical either way,
 * which is what keeps the response from revealing whether an address is
 * already registered.
 */
export async function insertWaitlistEmail(
  sql: Sql,
  input: { readonly email: string; readonly source: string },
): Promise<InsertWaitlistEmailResult> {
  const rows = await sql.query(
    `insert into waitlist (id, email, source)
     values ($1, $2, $3)
     on conflict do nothing
     returning id`,
    [randomUUID(), input.email, input.source],
  )
  return { inserted: rows.length > 0 }
}
