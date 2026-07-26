import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  FileResponseStore,
  MemoryResponseStore,
  type ResponseStore,
} from "./response-store.js"

function runResponseStoreContract(name: string, makeStore: () => ResponseStore): void {
  describe(`${name} revision semantics`, () => {
    const key = "financial-datasets|prices|AAPL|2020"

    it("stores revision 1 on first write and reads it back", async () => {
      const store = makeStore()
      const first = await store.append(key, { rows: [1, 2, 3] }, "2020-06-15T00:00:00Z")
      expect(first.revision).toBe(1)
      const latest = await store.read(key)
      expect(latest?.revision).toBe(1)
      expect(latest?.payload).toEqual({ rows: [1, 2, 3] })
    })

    it("does NOT append a new revision when the payload is unchanged", async () => {
      const store = makeStore()
      await store.append(key, { rows: [1, 2, 3] }, "2020-06-15T00:00:00Z")
      const again = await store.append(key, { rows: [1, 2, 3] }, "2020-06-16T00:00:00Z")
      expect(again.revision).toBe(1)
      expect((await store.revisions(key)).length).toBe(1)
    })

    it("appends a new revision when a re-fetch differs, and reads return the latest", async () => {
      const store = makeStore()
      await store.append(key, { rows: [1, 2, 3] }, "2020-06-15T00:00:00Z")
      const restated = await store.append(key, { rows: [1, 2, 4] }, "2020-06-20T00:00:00Z")
      expect(restated.revision).toBe(2)

      const revisions = await store.revisions(key)
      expect(revisions.map((r) => r.revision)).toEqual([1, 2])
      // Nothing is overwritten — the original revision is preserved.
      expect(revisions[0]?.payload).toEqual({ rows: [1, 2, 3] })

      const latest = await store.read(key)
      expect(latest?.revision).toBe(2)
      expect(latest?.payload).toEqual({ rows: [1, 2, 4] })
    })

    it("returns null for an unknown key", async () => {
      const store = makeStore()
      expect(await store.read("never-written")).toBeNull()
      expect(await store.revisions("never-written")).toEqual([])
    })
  })
}

runResponseStoreContract("MemoryResponseStore", () => new MemoryResponseStore())

describe("FileResponseStore", () => {
  let dir: string
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "engine-response-store-"))
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  let counter = 0
  // A fresh subdir per store so the shared contract's tests stay isolated.
  runResponseStoreContract(
    "FileResponseStore",
    () => new FileResponseStore(path.join(dir, `case-${counter++}`)),
  )

  it("persists revisions across store instances (same baseDir)", async () => {
    const key = "eodhd|prices|EQNR.OL|2020"
    const a = new FileResponseStore(dir)
    await a.append(key, { v: 1 }, "2020-01-01T00:00:00Z")
    await a.append(key, { v: 2 }, "2020-02-01T00:00:00Z")

    const b = new FileResponseStore(dir)
    const revisions = await b.revisions(key)
    expect(revisions.map((r) => r.revision)).toEqual([1, 2])
    expect((await b.read(key))?.payload).toEqual({ v: 2 })
  })
})
