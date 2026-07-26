import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vitest"

import { FileResponseStore, MemoryResponseStore } from "../data/response-store.js"
import type { LlmCompleteResponse } from "./client.js"
import { hashContext, PromptCache, promptCacheKey, type PromptAuditRecord } from "./prompt-cache.js"

const KEY_INPUT = {
  analystId: "llm.value",
  model: "test-model",
  promptVersion: "value.v1",
  renderedContext: "FUNDAMENTALS SNAPSHOT\nsecurity: X",
}

function record(overrides: Partial<PromptAuditRecord> = {}): PromptAuditRecord {
  const response: LlmCompleteResponse = {
    model: "test-model",
    raw: { id: "msg_1", content: [{ type: "tool_use", name: "record_value_view", input: { signal: "bullish" } }] },
    toolInput: { signal: "bullish", confidence: 80, reasoning: "strong moat" },
    stopReason: "tool_use",
  }
  return {
    analystId: KEY_INPUT.analystId,
    model: KEY_INPUT.model,
    promptVersion: KEY_INPUT.promptVersion,
    systemPrompt: "You are a value analyst.",
    renderedContext: KEY_INPUT.renderedContext,
    contextHash: hashContext(KEY_INPUT.renderedContext),
    response,
    parseStatus: "ok",
    createdAt: "2020-06-15T21:00:00.000Z",
    ...overrides,
  }
}

describe("promptCacheKey", () => {
  it("is stable and changes when any input changes", () => {
    const base = promptCacheKey(KEY_INPUT)
    expect(promptCacheKey(KEY_INPUT)).toBe(base)
    expect(promptCacheKey({ ...KEY_INPUT, model: "other" })).not.toBe(base)
    expect(promptCacheKey({ ...KEY_INPUT, renderedContext: "different" })).not.toBe(base)
  })
})

describe("PromptCache (memory)", () => {
  it("misses before a put and hits after (audit round-trip)", async () => {
    const cache = new PromptCache(new MemoryResponseStore())
    const key = cache.key(KEY_INPUT)
    expect(await cache.get(key)).toBeNull()

    const rec = record()
    await cache.put(rec)

    const hit = await cache.get(key)
    expect(hit).toEqual(rec)
    expect(hit?.response.toolInput).toEqual(rec.response.toolInput)
    expect(hit?.parseStatus).toBe("ok")
  })

  it("persists a failed parse with its raw response", async () => {
    const cache = new PromptCache(new MemoryResponseStore())
    const rec = record({ parseStatus: "failed", response: { model: "m", raw: { garbage: true }, toolInput: null, stopReason: "end_turn" } })
    await cache.put(rec)
    const hit = await cache.get(cache.key(KEY_INPUT))
    expect(hit?.parseStatus).toBe("failed")
    expect(hit?.response.raw).toEqual({ garbage: true })
  })
})

describe("PromptCache (file-backed)", () => {
  const dirs: string[] = []
  afterAll(async () => {
    for (const d of dirs) await fs.rm(d, { recursive: true, force: true })
  })

  it("round-trips a record through the file store", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hodget-cache-"))
    dirs.push(dir)
    const cache = new PromptCache(new FileResponseStore(dir))
    const rec = record()
    await cache.put(rec)
    const hit = await cache.get(cache.key(KEY_INPUT))
    expect(hit).toEqual(rec)
  })
})
