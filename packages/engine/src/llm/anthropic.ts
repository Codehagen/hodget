import Anthropic from "@anthropic-ai/sdk"

import {
  LlmTransportError,
  type LlmClient,
  type LlmCompleteRequest,
  type LlmCompleteResponse,
} from "./client.js"

/**
 * Thin adapter over the official `@anthropic-ai/sdk` using native tool /
 * JSON-schema **structured output** — the model is forced to call one tool and
 * we read its typed input, never prose. This is the only file in the engine
 * that imports the model SDK.
 *
 * Model and API key are resolved per-run (config → env), never held as a
 * module-global: multi-tenant runs each supply their own credentials.
 */

/** Default model, overridable per request/config or via `HODGET_LLM_MODEL`. */
export const DEFAULT_LLM_MODEL = "claude-sonnet-5"
const DEFAULT_MAX_TOKENS = 1024

/** Resolve the model id: explicit config → `HODGET_LLM_MODEL` → default. */
export function resolveModel(
  model?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return model ?? env.HODGET_LLM_MODEL ?? DEFAULT_LLM_MODEL
}

export interface AnthropicLlmClientConfig {
  /** Per-run API key. Falls back to `ANTHROPIC_API_KEY`. Never a module global. */
  readonly apiKey?: string
  /** Default model. Falls back to `HODGET_LLM_MODEL`, then {@link DEFAULT_LLM_MODEL}. */
  readonly model?: string
  readonly maxTokens?: number
  /** Injectable SDK client (preconfigured or for adapter-level tests). */
  readonly client?: Pick<Anthropic, "messages">
}

/**
 * Read the forced tool's structured input out of a completed message. Returns
 * `null` when the model produced no matching `tool_use` block (a failed parse
 * for the caller). Exported so the extraction is unit-testable without network.
 */
export function extractToolInput(message: Anthropic.Message, toolName: string): unknown {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === toolName) return block.input
  }
  return null
}

export class AnthropicLlmClient implements LlmClient {
  private readonly sdk: Pick<Anthropic, "messages">
  private readonly model: string
  private readonly maxTokens: number

  constructor(config: AnthropicLlmClientConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY
    this.sdk = config.client ?? new Anthropic(apiKey === undefined ? {} : { apiKey })
    this.model = resolveModel(config.model)
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
  }

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse> {
    const model = request.model ?? this.model
    let message: Anthropic.Message
    try {
      message = await this.sdk.messages.create({
        model,
        max_tokens: request.maxTokens ?? this.maxTokens,
        // Structured output is a forced tool call; thinking is disabled so the
        // one guaranteed output is the tool input, not free-form reasoning.
        thinking: { type: "disabled" },
        system: request.system,
        tools: [
          {
            name: request.tool.name,
            description: request.tool.description,
            input_schema: request.tool.inputSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: request.tool.name },
        messages: [{ role: "user", content: request.prompt }],
      })
    } catch (err) {
      throw new LlmTransportError("Anthropic request failed", { cause: err })
    }
    return {
      model: message.model ?? model,
      raw: message,
      toolInput: extractToolInput(message, request.tool.name),
      stopReason: message.stop_reason ?? null,
    }
  }
}
