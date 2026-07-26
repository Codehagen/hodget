import { describe, expect, it } from "vitest"

import { createDemoConversation } from "@/components/dashboard/ask/demo-conversation"

/**
 * The Ask Hodget script (plan 012): the scripted conversation's structure is
 * the UI contract — user/assistant alternation, reasoning-first assistant
 * turns, tool parts on the ledger-backed answers, and the run_card data part
 * on the performance answer.
 */

const messages = createDemoConversation().get()

describe("createDemoConversation", () => {
  it("scripts four alternating user/assistant exchanges", () => {
    expect(messages).toHaveLength(8)
    expect(messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
    ])
  })

  it("opens every assistant turn with a reasoning part", () => {
    for (const message of messages.filter((m) => m.role === "assistant")) {
      const firstMeaningful = message.parts.find(
        (p) => p.type !== "step-start"
      )
      expect(firstMeaningful?.type).toBe("reasoning")
    }
  })

  it("carries lookup_decision tool calls for MSFT and NVDA", () => {
    const toolParts = messages
      .flatMap((m) => m.parts)
      .filter((p) => p.type === "tool-lookup_decision")
    const securities = toolParts.map(
      (p) => (p as { input?: { security?: string } }).input?.security
    )
    expect(securities).toContain("MSFT")
    expect(securities).toContain("NVDA")
  })

  it("attaches the run_card artifact to the performance answer", () => {
    const card = messages
      .flatMap((m) => m.parts)
      .find((p) => p.type === "data-run_card") as
      | { data: { runId: string } }
      | undefined
    expect(card?.data.runId).toBe("run_8c41ca")
  })

  it("is deterministic — two builds script identical messages", () => {
    const again = createDemoConversation().get()
    expect(JSON.stringify(again)).toBe(JSON.stringify(messages))
  })
})
