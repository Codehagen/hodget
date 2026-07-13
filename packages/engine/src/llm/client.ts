/**
 * The LLM port (plan 002). Analysts talk to models exclusively through this
 * small interface, and only ever via **native structured output** — a tool /
 * JSON-schema call — never by parsing prose. A real adapter
 * ({@link AnthropicLlmClient}) and a scriptable {@link FakeLlmClient} implement
 * it; nothing else in the engine imports a model SDK.
 */

/** A native structured-output tool: the schema the model must fill in. */
export interface LlmToolSchema {
  readonly name: string
  readonly description: string
  /** JSON Schema for the tool input — the structured shape the model returns. */
  readonly inputSchema: Record<string, unknown>
}

export interface LlmCompleteRequest {
  /** System prompt (persona instructions). */
  readonly system: string
  /** Rendered, deterministic user context the model reasons over. */
  readonly prompt: string
  /** The structured-output tool the model is forced to call. */
  readonly tool: LlmToolSchema
  /** Model id; the client falls back to its own default when omitted. */
  readonly model?: string
  readonly maxTokens?: number
}

export interface LlmCompleteResponse {
  /** The model that actually served the response. */
  readonly model: string
  /** The full provider payload, retained verbatim for the audit record. */
  readonly raw: unknown
  /**
   * The structured tool input the model produced, or `null` if it called no
   * tool. Callers validate this against their own schema; a `null` or malformed
   * value is a failed parse (the analyst abstains), never a crash.
   */
  readonly toolInput: unknown
  readonly stopReason: string | null
}

export interface LlmClient {
  complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse>
}

/** Raised by adapters when the transport itself fails (network, API error). */
export class LlmTransportError extends Error {
  override readonly name = "LlmTransportError"
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    Object.setPrototypeOf(this, LlmTransportError.prototype)
  }
}
