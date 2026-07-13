import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, it } from "vitest"

import { DEFAULT_LLM_MODEL, extractToolInput, resolveModel } from "./anthropic.js"

describe("resolveModel", () => {
  it("prefers an explicit model", () => {
    expect(resolveModel("claude-custom", {})).toBe("claude-custom")
  })

  it("falls back to HODGET_LLM_MODEL, then the default", () => {
    expect(resolveModel(undefined, { HODGET_LLM_MODEL: "env-model" })).toBe("env-model")
    expect(resolveModel(undefined, {})).toBe(DEFAULT_LLM_MODEL)
  })
})

describe("extractToolInput", () => {
  function message(content: unknown[]): Anthropic.Message {
    return { content } as unknown as Anthropic.Message
  }

  it("returns the matching tool call's input", () => {
    const msg = message([
      { type: "text", text: "thinking..." },
      { type: "tool_use", name: "record_value_view", input: { signal: "bullish" } },
    ])
    expect(extractToolInput(msg, "record_value_view")).toEqual({ signal: "bullish" })
  })

  it("returns null when no matching tool call is present", () => {
    expect(extractToolInput(message([{ type: "text", text: "hi" }]), "record_value_view")).toBeNull()
    expect(
      extractToolInput(message([{ type: "tool_use", name: "other", input: {} }]), "record_value_view"),
    ).toBeNull()
  })
})
