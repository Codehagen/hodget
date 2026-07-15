import { createChat, type AiSdkChat } from "@shadcn/helpers/ai-sdk"
import type { UIDataTypes } from "ai"

/**
 * The scripted "Ask the fund" conversation (plan 006).
 *
 * Like every other demo surface, this invents nothing: each answer restates
 * the committed decision fixtures — the same MSFT / NVDA decision days the run
 * replay and the decision map render (see demo-data's DECISIONS_BY_STRATEGY).
 * It streams through the real AI SDK `useChat` lifecycle via
 * `@shadcn/helpers/ai-sdk`, so swapping in a live model later is a transport
 * change, not a UI rewrite.
 *
 * `now` is pinned so message timestamps are deterministic (the repo's fixture
 * rule: nothing derives from the wall clock).
 */

export type AskTools = {
  lookup_decision: {
    input: { security: string; date: string }
    output: {
      security: string
      date: string
      committeeNet: number
      targetWeightPct: number
      gate: string
      fill: string
    }
  }
}

export type AskChat = AiSdkChat<unknown, UIDataTypes, AskTools>

/** Fresh script per mount so Restart replays from the top. */
export function createDemoConversation(): AskChat {
  return createChat<unknown, UIDataTypes, AskTools>({
    messageIdPrefix: "ask-demo",
    now: "2026-07-13T09:00:00.000Z",
  })
    .user("Why did the fund sell MSFT?")
    .sleep(400)
    .assistant(({ writer }) => {
      writer
        .tool("lookup_decision", {
          title: "Reading the decision ledger",
          input: { security: "MSFT", date: "2026-07-09" },
        })
        .sleep(900)
        .output({
          security: "MSFT",
          date: "2026-07-09",
          committeeNet: -0.11,
          targetWeightPct: -1.4,
          gate: "pass — within limits",
          fill: "SELL 340 @ 471.90",
        })
      writer.text(
        "On July 9 the earnings-drift analyst turned negative on MSFT at −0.21: " +
          "“Azure decelerated vs consensus; fade the initial pop.” The value analyst " +
          "sat at +0.05 and declined to press the short. Blended by committee weight, " +
          "the net view came to −0.11, which maps to a −1.4% target. The risk gate " +
          "passed it within limits, and the order settled next session: 340 shares " +
          "sold at 471.90. Every step of that path is in the ledger — the Decisions " +
          "page walks the same trail node by node."
      )
    })
    .user("What did the value analyst think?")
    .sleep(400)
    .assistant(
      "The value analyst was mildly positive at +0.05 — “Long-term compounder — " +
        "declines to press the short.” Disagreement like this is expected: analysts " +
        "form views independently, and the committee blends them by weight. A " +
        "dissenting view never disappears; it is recorded beside the decision, so " +
        "you can always see who disagreed, and why, before the trade was made."
    )
    .user("Why is the NVDA position only 5%?")
    .sleep(400)
    .assistant(({ writer }) => {
      writer
        .tool("lookup_decision", {
          title: "Reading the decision ledger",
          input: { security: "NVDA", date: "2026-07-08" },
        })
        .sleep(900)
        .output({
          security: "NVDA",
          date: "2026-07-08",
          committeeNet: 0.56,
          targetWeightPct: 5,
          gate: "clip — 8% → 5% (max single-name position)",
          fill: "BUY 1,240 @ 168.42",
        })
      writer.text(
        "After the July 8 earnings beat, the committee's net view on NVDA was " +
          "+0.56 — an 8% target. The risk gate clipped it to 5%, the maximum " +
          "single-name position, and 1,240 shares filled at 168.42. Two days later " +
          "the drift had decayed and the committee held the reduced clip rather " +
          "than adding. That split is the design: models form the views, " +
          "deterministic risk code does the sizing — no analyst can size past the gate."
      )
    })
}
