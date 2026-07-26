import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createTestDb, type TestDb } from "../testing/pglite.js"
import { hitRateLimit } from "./rate-limit.js"

/**
 * One pglite instance for the file, truncated between tests — spinning up
 * Postgres is the expensive part and nothing here needs a pristine database.
 */
let db: TestDb

beforeAll(async () => {
  db = await createTestDb()
})

beforeEach(async () => {
  await db.query("delete from rate_limit_hits")
})

afterAll(async () => {
  await db.close()
})

const WINDOW_MS = 60_000
const MAX = 5

function hit(bucket: string, now: Date) {
  return hitRateLimit(db, { bucket, windowMs: WINDOW_MS, max: MAX, now })
}

describe("hitRateLimit", () => {
  it("allows up to max within a window and blocks the next", async () => {
    const t0 = new Date("2026-07-26T12:00:00.000Z")
    for (let i = 1; i <= MAX; i++) {
      const result = await hit("bucket-a", t0)
      expect(result).toEqual({ allowed: true, count: i })
    }
    expect(await hit("bucket-a", t0)).toEqual({ allowed: false, count: 6 })
  })

  it("counts each bucket independently", async () => {
    const t0 = new Date("2026-07-26T12:00:00.000Z")
    for (let i = 0; i < MAX + 1; i++) await hit("bucket-a", t0)

    expect(await hit("bucket-b", t0)).toEqual({ allowed: true, count: 1 })
  })

  it("rolls over when the next window opens", async () => {
    const t0 = new Date("2026-07-26T12:00:00.000Z")
    for (let i = 0; i < MAX + 1; i++) await hit("bucket-a", t0)
    expect((await hit("bucket-a", t0)).allowed).toBe(false)

    const next = new Date(t0.getTime() + WINDOW_MS)
    expect(await hit("bucket-a", next)).toEqual({ allowed: true, count: 1 })
  })

  it("shares one budget across separate callers", async () => {
    // The whole point of moving off an in-memory Map: two callers holding
    // different handles to the same database must draw from one budget.
    const t0 = new Date("2026-07-26T12:00:00.000Z")
    const results = []
    for (let i = 0; i < MAX + 1; i++) {
      results.push(
        await hitRateLimit(db, {
          bucket: "shared",
          windowMs: WINDOW_MS,
          max: MAX,
          now: t0,
        }),
      )
    }
    expect(results.filter((r) => r.allowed)).toHaveLength(MAX)
    expect(results.at(-1)?.allowed).toBe(false)
  })

  it("prunes rows whose window has long passed", async () => {
    const old = new Date("2026-07-26T10:00:00.000Z")
    await hit("bucket-old", old)
    expect(await db.query("select bucket from rate_limit_hits")).toHaveLength(1)

    // Three hours later, the first hit of a new window triggers the prune.
    const later = new Date("2026-07-26T13:00:00.000Z")
    await hit("bucket-new", later)

    const rows = await db.query<{ bucket: string }>(
      "select bucket from rate_limit_hits",
    )
    expect(rows.map((r) => r.bucket)).toEqual(["bucket-new"])
  })
})
