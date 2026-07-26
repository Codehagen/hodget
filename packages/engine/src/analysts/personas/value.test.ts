import { describe, expect, it } from "vitest"

import { DataUnavailableError } from "../../data/errors.js"
import { FIXTURE_IDS } from "../../data/fixture/dataset.js"
import { loadFixtureMarketData } from "../../data/fixture/fixture-market-data.js"
import type { MarketData } from "../../data/market-data.js"
import {
  MemoryResponseStore,
  type ResponseStore,
  type StoredResponse,
} from "../../data/response-store.js"
import { errorResult, FakeLlmClient, toolResult } from "../../llm/fake.js"
import { PromptCache, type PromptAuditRecord } from "../../llm/prompt-cache.js"
import type { AnalystContext } from "../../types.js"
import { createValueAnalyst } from "./value.js"

const AS_OF = "2020-09-01T21:00:00Z"
const MODEL = "test-model"
const NOW = () => "2020-09-01T21:00:00.000Z"

/** A ResponseStore that records every append, so tests can inspect the audit. */
class RecordingStore implements ResponseStore {
  readonly appended: PromptAuditRecord[] = []
  constructor(private readonly inner: ResponseStore = new MemoryResponseStore()) {}
  revisions(key: string): Promise<StoredResponse[]> {
    return this.inner.revisions(key)
  }
  read(key: string): Promise<StoredResponse | null> {
    return this.inner.read(key)
  }
  async append(key: string, payload: unknown, observedAt?: string): Promise<StoredResponse> {
    this.appended.push(payload as PromptAuditRecord)
    return this.inner.append(key, payload, observedAt)
  }
}

function ctx(data: MarketData, securityId: string = FIXTURE_IDS.usEquity): AnalystContext {
  return { securityId, asOf: AS_OF, data }
}

async function fixture(): Promise<MarketData> {
  return loadFixtureMarketData()
}

describe("value persona", () => {
  it("maps a valid structured output to conviction = sign × confidence/100", async () => {
    const data = await fixture()
    const llm = new FakeLlmClient(toolResult({ signal: "bullish", confidence: 80, reasoning: "wide moat, cheap" }))
    const store = new RecordingStore()
    const analyst = createValueAnalyst({ llm, cache: new PromptCache(store), model: MODEL, now: NOW })

    const signal = await analyst.predict(ctx(data))
    expect(signal.abstained).toBe(false)
    expect(signal.conviction).toBeCloseTo(0.8, 12)
    expect(signal.components?.confidence).toBe(80)
    expect(signal.horizonDays).toBe(250)
    expect(llm.calls).toHaveLength(1)
    expect(store.appended[0]?.parseStatus).toBe("ok")
  })

  it("maps bearish to a negative conviction", async () => {
    const data = await fixture()
    const llm = new FakeLlmClient(toolResult({ signal: "bearish", confidence: 60, reasoning: "overvalued" }))
    const analyst = createValueAnalyst({ llm, cache: new PromptCache(new MemoryResponseStore()), model: MODEL, now: NOW })
    const signal = await analyst.predict(ctx(data))
    expect(signal.conviction).toBeCloseTo(-0.6, 12)
  })

  it("treats a genuine neutral as a real (non-abstained) view", async () => {
    const data = await fixture()
    const llm = new FakeLlmClient(toolResult({ signal: "neutral", confidence: 40, reasoning: "mixed" }))
    const analyst = createValueAnalyst({ llm, cache: new PromptCache(new MemoryResponseStore()), model: MODEL, now: NOW })
    const signal = await analyst.predict(ctx(data))
    expect(signal.conviction).toBe(0)
    expect(signal.abstained).toBe(false)
  })

  it("reuses the cached decision on a second run (cache hit ⇒ no LLM call)", async () => {
    const data = await fixture()
    const cache = new PromptCache(new MemoryResponseStore())
    const first = new FakeLlmClient(toolResult({ signal: "bullish", confidence: 70, reasoning: "quality" }))
    const a1 = createValueAnalyst({ llm: first, cache, model: MODEL, now: NOW })
    const s1 = await a1.predict(ctx(data))
    expect(first.calls).toHaveLength(1)

    // A client that throws if invoked — a cache hit must not call it.
    const second = new FakeLlmClient(errorResult(new Error("must not be called")))
    const a2 = createValueAnalyst({ llm: second, cache, model: MODEL, now: NOW })
    const s2 = await a2.predict(ctx(data))
    expect(second.calls).toHaveLength(0)
    expect(s2.conviction).toBe(s1.conviction)
    expect(s2.abstained).toBe(false)
  })

  it("abstains and persists the raw response on a malformed structured output", async () => {
    const data = await fixture()
    const store = new RecordingStore()
    const llm = new FakeLlmClient(toolResult({ not: "the right shape" }, { raw: { id: "msg_bad" } }))
    const analyst = createValueAnalyst({ llm, cache: new PromptCache(store), model: MODEL, now: NOW })

    const signal = await analyst.predict(ctx(data))
    expect(signal.abstained).toBe(true)
    expect(signal.conviction).toBe(0)
    expect(store.appended[0]?.parseStatus).toBe("failed")
    expect(store.appended[0]?.response.raw).toEqual({ id: "msg_bad" })
  })

  it("abstains on an LLM transport error (never crashes) and persists nothing", async () => {
    const data = await fixture()
    const store = new RecordingStore()
    const llm = new FakeLlmClient(errorResult(new Error("network down")))
    const analyst = createValueAnalyst({ llm, cache: new PromptCache(store), model: MODEL, now: NOW })

    const signal = await analyst.predict(ctx(data))
    expect(signal.abstained).toBe(true)
    expect(store.appended).toHaveLength(0)
  })

  it("abstains on insufficient data without calling the LLM", async () => {
    const data = await fixture()
    const llm = new FakeLlmClient(errorResult(new Error("must not be called")))
    const analyst = createValueAnalyst({ llm, cache: new PromptCache(new MemoryResponseStore()), model: MODEL, now: NOW })

    const signal = await analyst.predict(ctx(data, FIXTURE_IDS.unknown))
    expect(signal.abstained).toBe(true)
    expect(llm.calls).toHaveLength(0)
  })

  it("propagates a DataUnavailableError (fail loud, not an abstain)", async () => {
    const data = await fixture()
    const llm = new FakeLlmClient(errorResult(new Error("must not be called")))
    const analyst = createValueAnalyst({ llm, cache: new PromptCache(new MemoryResponseStore()), model: MODEL, now: NOW })

    await expect(analyst.predict(ctx(data, FIXTURE_IDS.poison))).rejects.toBeInstanceOf(
      DataUnavailableError,
    )
    expect(llm.calls).toHaveLength(0)
  })
})
