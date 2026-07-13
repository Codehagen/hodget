import type { LlmClient, LlmCompleteRequest, LlmCompleteResponse } from "./client.js"

/**
 * A scriptable {@link LlmClient} for tests: no network, fully deterministic.
 * Script it with structured tool inputs (valid or malformed) or errors, and
 * inspect {@link FakeLlmClient.calls} to assert whether the model was invoked
 * at all (e.g. a cache hit must produce zero calls).
 */

export interface FakeToolResult {
  readonly kind: "tool"
  /** The structured output the model "returns" (validated by the caller). */
  readonly toolInput: unknown
  readonly raw?: unknown
  readonly model?: string
  readonly stopReason?: string | null
}

export interface FakeErrorResult {
  readonly kind: "error"
  readonly error: Error
}

export type FakeLlmResult = FakeToolResult | FakeErrorResult

/** A valid structured-output response. */
export function toolResult(
  toolInput: unknown,
  overrides: Omit<Partial<FakeToolResult>, "kind" | "toolInput"> = {},
): FakeToolResult {
  return { kind: "tool", toolInput, ...overrides }
}

/** A transport failure — `complete()` will throw this error. */
export function errorResult(error: Error): FakeErrorResult {
  return { kind: "error", error }
}

/** A single result, a queue consumed in order, or a per-request function. */
export type FakeLlmScript =
  | FakeLlmResult
  | readonly FakeLlmResult[]
  | ((request: LlmCompleteRequest) => FakeLlmResult)

export class FakeLlmClient implements LlmClient {
  /** Every request received, in order — for asserting call counts. */
  readonly calls: LlmCompleteRequest[] = []
  private readonly queue: FakeLlmResult[] | null
  private readonly fn: ((request: LlmCompleteRequest) => FakeLlmResult) | null
  private readonly single: FakeLlmResult | null

  constructor(script: FakeLlmScript) {
    if (typeof script === "function") {
      this.fn = script
      this.queue = null
      this.single = null
    } else if (Array.isArray(script)) {
      this.fn = null
      this.queue = [...(script as readonly FakeLlmResult[])]
      this.single = null
    } else {
      this.fn = null
      this.queue = null
      this.single = script as FakeLlmResult
    }
  }

  private nextResult(request: LlmCompleteRequest): FakeLlmResult {
    if (this.fn) return this.fn(request)
    if (this.queue) {
      const next = this.queue.shift()
      if (!next) throw new Error("FakeLlmClient: script exhausted")
      return next
    }
    if (this.single) return this.single
    throw new Error("FakeLlmClient: no script")
  }

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse> {
    this.calls.push(request)
    const result = this.nextResult(request)
    if (result.kind === "error") throw result.error
    return {
      model: result.model ?? request.model ?? "fake-model",
      raw: result.raw ?? { toolInput: result.toolInput },
      toolInput: result.toolInput,
      stopReason: result.stopReason ?? "tool_use",
    }
  }
}
