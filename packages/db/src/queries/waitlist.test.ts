import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createTestDb, type TestDb } from "../testing/pglite.js"
import { insertWaitlistEmail } from "./waitlist.js"

/**
 * One pglite instance for the file, truncated between tests, rather than the
 * per-test instance queries.test.ts uses: spinning up Postgres is the expensive
 * part, and `pnpm turbo test` already runs these suites against a contended box.
 * Nothing here depends on a pristine database — only on an empty `waitlist`.
 */
let db: TestDb

beforeAll(async () => {
  db = await createTestDb()
})

beforeEach(async () => {
  await db.query("delete from waitlist")
})

afterAll(async () => {
  await db.close()
})

describe("waitlist queries", () => {
  it("inserts an address and reports it as new", async () => {
    const result = await insertWaitlistEmail(db, {
      email: "a@b.co",
      source: "landing",
    })

    expect(result.inserted).toBe(true)
    const rows = await db.query<{ email: string; source: string }>(
      "select email, source from waitlist",
    )
    expect(rows).toEqual([{ email: "a@b.co", source: "landing" }])
  })

  it("absorbs a repeat address instead of raising, and writes no second row", async () => {
    await insertWaitlistEmail(db, { email: "a@b.co", source: "landing" })
    const again = await insertWaitlistEmail(db, {
      email: "a@b.co",
      source: "demo-sidebar",
    })

    expect(again.inserted).toBe(false)
    const rows = await db.query("select id from waitlist")
    expect(rows).toHaveLength(1)
  })

  it("treats addresses as duplicates case-insensitively", async () => {
    await insertWaitlistEmail(db, { email: "a@b.co", source: "landing" })
    const again = await insertWaitlistEmail(db, {
      email: "A@B.CO",
      source: "landing",
    })

    expect(again.inserted).toBe(false)
  })

  it("rejects a value the column CHECK forbids", async () => {
    await expect(
      insertWaitlistEmail(db, { email: "no-at-sign", source: "landing" }),
    ).rejects.toThrow()
  })

  it("requires a dot in the domain, matching the app's regex (plan 022)", async () => {
    // Before migration 0004 the constraint only required an `@`, so the column
    // was weaker than the action's validation. These must now agree.
    await expect(
      insertWaitlistEmail(db, { email: "a@b", source: "landing" }),
    ).rejects.toThrow()
  })

  it("rejects an address with whitespace", async () => {
    await expect(
      insertWaitlistEmail(db, { email: "a b@c.co", source: "landing" }),
    ).rejects.toThrow()
  })
})
