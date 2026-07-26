import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * transaction() error fidelity and pool hygiene (plan 008). pglite backs the
 * query-level tests elsewhere; these cases are about `pg.Pool` mechanics —
 * ROLLBACK failing on a dead connection and `release(err)` eviction — so the
 * pool is a scripted fake installed via vi.mock.
 */

type FakeClient = {
  calls: string[]
  released: unknown[]
  rollbackFails: boolean
  query: (text: string) => Promise<{ rows: unknown[] }>
  release: (err?: unknown) => void
}

function makeFakeClient(): FakeClient {
  const client: FakeClient = {
    calls: [],
    released: [],
    rollbackFails: false,
    query(text: string) {
      client.calls.push(text)
      if (text === "ROLLBACK" && client.rollbackFails) {
        return Promise.reject(new Error("rollback failed"))
      }
      return Promise.resolve({ rows: [] })
    },
    release(err?: unknown) {
      client.released.push(err)
    },
  }
  return client
}

const fake = { client: makeFakeClient() }

vi.mock("pg", () => ({
  Pool: class {
    connect() {
      return Promise.resolve(fake.client)
    }
  },
}))

import { createPgSql } from "./client.js"

beforeEach(() => {
  fake.client = makeFakeClient()
})

describe("createPgSql transaction()", () => {
  const sql = () => createPgSql("postgres://unused")

  it("commits and releases the client back to the pool on success", async () => {
    const value = await sql().transaction(async () => "ok")
    expect(value).toBe("ok")
    expect(fake.client.calls).toEqual(["BEGIN", "COMMIT"])
    expect(fake.client.released).toEqual([undefined])
  })

  it("rolls back, rethrows the original error, and evicts the client", async () => {
    const boom = new Error("boom")
    await expect(
      sql().transaction(async () => {
        throw boom
      }),
    ).rejects.toBe(boom)
    expect(fake.client.calls).toEqual(["BEGIN", "ROLLBACK"])
    expect(fake.client.released).toEqual([boom])
  })

  it("preserves the original error even when ROLLBACK itself fails", async () => {
    fake.client.rollbackFails = true
    const boom = new Error("boom")
    await expect(
      sql().transaction(async () => {
        throw boom
      }),
    ).rejects.toBe(boom)
    // The failed connection is still evicted, carrying the original error.
    expect(fake.client.released).toEqual([boom])
  })
})
