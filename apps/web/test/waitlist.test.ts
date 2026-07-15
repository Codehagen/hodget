import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * insertWaitlistEmail — the deliberately-public DAL surface (plan 007). The
 * Supabase client is mocked at the module seam (same style as
 * dal-runs.test.ts); the contract under test is the three outcomes: clean
 * insert, duplicate treated as success, and any other error mapped to a
 * generic failure.
 */

const insert = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      expect(table).toBe("waitlist")
      return { insert }
    },
  }),
}))

import { allowWaitlistAttempt, insertWaitlistEmail } from "@/lib/dal/waitlist"

beforeEach(() => {
  insert.mockReset()
})

describe("insertWaitlistEmail", () => {
  it("returns ok on a clean insert", async () => {
    insert.mockResolvedValue({ error: null })
    expect(await insertWaitlistEmail("a@b.co", "landing")).toEqual({
      ok: true,
      duplicate: false,
    })
    expect(insert).toHaveBeenCalledWith({ email: "a@b.co", source: "landing" })
  })

  it("treats a unique violation as an already-subscribed success", async () => {
    insert.mockResolvedValue({ error: { code: "23505" } })
    expect(await insertWaitlistEmail("a@b.co", "landing")).toEqual({
      ok: true,
      duplicate: true,
    })
  })

  it("maps any other database error to a generic failure", async () => {
    insert.mockResolvedValue({ error: { code: "42P01" } })
    expect(await insertWaitlistEmail("a@b.co", "landing")).toEqual({ ok: false })
  })
})

describe("allowWaitlistAttempt", () => {
  it("allows up to 5 attempts per key per window, blocks the 6th", () => {
    const t0 = 1_000_000
    for (let i = 0; i < 5; i++) {
      expect(allowWaitlistAttempt("ip-a", t0 + i)).toBe(true)
    }
    expect(allowWaitlistAttempt("ip-a", t0 + 5)).toBe(false)
    // A different key is unaffected.
    expect(allowWaitlistAttempt("ip-b", t0 + 5)).toBe(true)
  })

  it("resets when a new window starts", () => {
    const t0 = 2_000_000
    for (let i = 0; i < 6; i++) allowWaitlistAttempt("ip-c", t0)
    expect(allowWaitlistAttempt("ip-c", t0)).toBe(false)
    expect(allowWaitlistAttempt("ip-c", t0 + 60_000)).toBe(true)
  })
})
