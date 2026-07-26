import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * insertWaitlistEmail + allowWaitlistAttempt — the deliberately-public DAL
 * surface (plan 007, hardened in plan 022). The `@workspace/db` queries are
 * mocked through hoisted handles rather than imported (the DAL boundary lint
 * forbids importing the engine DB package in tests, same as dal-runs.test.ts).
 *
 * The SQL itself — the ON CONFLICT duplicate path, the case-insensitive unique
 * index, the column CHECK, and the rate-limit window arithmetic — is covered
 * against a real pglite database in packages/db/src/queries/.
 */
const { insertRowMock, hitRateLimitMock } = vi.hoisted(() => ({
  insertRowMock: vi.fn(),
  hitRateLimitMock: vi.fn(),
}))

vi.mock("@workspace/db", () => ({
  insertWaitlistEmail: insertRowMock,
  hitRateLimit: hitRateLimitMock,
}))

// Mocked so importing the DAL opens no pool and never reads DATABASE_URL.
vi.mock("@/lib/dal/db", () => ({ getDb: vi.fn(() => ({})) }))

import {
  allowWaitlistAttempt,
  bucketForIp,
  insertWaitlistEmail,
} from "@/lib/dal/waitlist"

beforeEach(() => {
  insertRowMock.mockReset()
  hitRateLimitMock.mockReset()
})

describe("insertWaitlistEmail", () => {
  it("returns ok on a clean insert", async () => {
    insertRowMock.mockResolvedValue({ inserted: true })
    expect(await insertWaitlistEmail("a@b.co", "landing")).toEqual({
      ok: true,
      duplicate: false,
    })
    expect(insertRowMock).toHaveBeenCalledWith(expect.anything(), {
      email: "a@b.co",
      source: "landing",
    })
  })

  it("treats a repeat address as an already-subscribed success", async () => {
    insertRowMock.mockResolvedValue({ inserted: false })
    expect(await insertWaitlistEmail("a@b.co", "landing")).toEqual({
      ok: true,
      duplicate: true,
    })
  })

  it("maps a database failure to a generic failure", async () => {
    insertRowMock.mockRejectedValue(new Error("connection refused"))
    expect(await insertWaitlistEmail("a@b.co", "landing")).toEqual({ ok: false })
  })
})

describe("bucketForIp", () => {
  it("hashes the address so no raw IP reaches the database", () => {
    const bucket = bucketForIp("203.0.113.7")
    expect(bucket).not.toContain("203.0.113.7")
    expect(bucket).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is stable for the same address and distinct across addresses", () => {
    expect(bucketForIp("203.0.113.7")).toBe(bucketForIp("203.0.113.7"))
    expect(bucketForIp("203.0.113.7")).not.toBe(bucketForIp("203.0.113.8"))
  })
})

describe("allowWaitlistAttempt", () => {
  it("passes the bucket through and allows when under the cap", async () => {
    hitRateLimitMock.mockResolvedValue({ allowed: true, count: 2 })
    expect(await allowWaitlistAttempt("hash-a")).toBe(true)
    expect(hitRateLimitMock).toHaveBeenCalledWith(expect.anything(), {
      bucket: "hash-a",
      windowMs: 60_000,
      max: 5,
      now: undefined,
    })
  })

  it("blocks when the limiter says the cap is exceeded", async () => {
    hitRateLimitMock.mockResolvedValue({ allowed: false, count: 6 })
    expect(await allowWaitlistAttempt("hash-a")).toBe(false)
  })

  it("fails OPEN when the limiter query throws", async () => {
    // A limiter outage must never be able to close the signup form; the insert
    // this guards will fail on its own if the database is genuinely down.
    hitRateLimitMock.mockRejectedValue(new Error("connection refused"))
    expect(await allowWaitlistAttempt("hash-a")).toBe(true)
  })
})
