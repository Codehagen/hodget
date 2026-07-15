# Plan 006 — "Ask the fund": a scripted conversational surface

## Goal

Add the conversational layer the decision map hints at: a chat surface where a
visitor asks the fund plain-language questions — "Why did the fund sell MSFT?"
— and the fund answers with the committee's actual reasoning, grounded in the
same demo fixtures as everything else.

Like the simulated run (plan 005), this ships as a **scripted demo**: no model,
no API key, no backend. Unlike plan 005's hand-rolled walker, the chat streams
through the real AI SDK lifecycle using shadcn's `@shadcn/helpers/ai-sdk`
scripted-conversation helper — so the UI is built against genuine `useChat`
streaming, and pointing it at a live model later is a transport swap, not a
rewrite.

## Building blocks (June 2026 shadcn chat components)

| Piece | Source | Role |
| --- | --- | --- |
| `message-scroller` | already in `packages/ui` (plan 005) | conversation scroll container: anchored turns, auto-follow, jump-to-end |
| `message` | shadcn CLI → `packages/ui` | row layout: avatar, alignment, header, grouped messages |
| `bubble` | shadcn CLI → `packages/ui` | message surface with variants (user `default`, assistant `ghost`) |
| `marker` | already in `packages/ui` (plan 005) | date separator, streaming status |
| `scroll-fade` + `shimmer` | CSS utilities from `shadcn/tailwind.css`, appended to `packages/ui/src/styles/globals.css` | edge fades on the scroller (already referenced by `scroll-fade-b` in message-scroller) and the "Thinking…" live-status text |
| `@shadcn/helpers/ai-sdk` | npm dep in `apps/web` (+ `ai`, `@ai-sdk/react`) | `createChat()` scripted conversation streamed through `useChat` via `chat.transport()` |

`attachment` is skipped — no file surfaces in this conversation yet.

## Design

### The conversation is fixture-derived, not invented

`components/dashboard/ask/demo-conversation.ts` scripts three exchanges built
from the committed decision fixtures (the same MSFT/NVDA/AAPL decision days the
run replay and decision map render):

1. **"Why did the fund sell MSFT?"** — assistant streams a `lookup_decision`
   tool call (title "Reading the decision ledger", input `{security: "MSFT"}`,
   output with the committee row), then explains: earnings-drift at −0.21
   (Azure deceleration), value analyst at +0.05 declining to press the short,
   committee net −0.11 → −1.4% target, risk gate pass, SELL 340 @ 471.90.
2. **"What did the value analyst think?"** — the written thesis, and how a
   dissenting view gets outweighed but recorded.
3. **"Why is the NVDA position only 5%?"** — the risk gate clip 8% → 5% (max
   single-name position), pointing at the decision map.

`createChat({ now: <fixed ISO> })` keeps message timestamps deterministic,
matching the repo's no-`Date.now()` fixture rule.

### Read-only demo input (the shadcn launch pattern)

The composer is the canonical scripted-demo composer: it displays the **next
predefined question** (`chat.next(messages)`) in a disabled input with a live
Send button, plus a "Demo is read only" hint. Pressing Send streams that
exchange; when the script is exhausted the composer says the conversation is
complete and offers Restart. Visitors can't type — this surface demonstrates,
it does not pretend a model is listening.

### Rendering

- `MessageScroller` (with the now-functional `scroll-fade-b` edge fade) wraps
  the thread; jump-to-end button appears when scrolled up.
- User turns: `Message align="end"` + `Bubble` (primary). Assistant turns:
  `Bubble variant="ghost"` so answers read as content, not balloons — with a
  `MessageHeader` naming the committee.
- Tool parts render as a `Marker` row (icon + "Reading the decision ledger…")
  that resolves to a compact result line; while `status === "streaming"` with
  no visible text yet, a `Marker` shows shimmer "Thinking…".
- A `Marker variant="separator"` date break opens the thread.

### Placement

New sidebar item **Ask** (Overview group, chat icon) → `app/demo/ask/page.tsx`
(public, static) and `app/dashboard/ask/page.tsx` (session-guarded), both
rendering `AskView` with the surface's base path for in-answer links to the
decision pages. Everything is client-side after hydration; the pages prerender
statically like the rest of the demo.

## Steps

1. `packages/ui`: `shadcn add message bubble`; append `scroll-fade` +
   `shimmer` utilities to `globals.css` (credited to shadcn/tailwind.css).
2. `apps/web`: add `ai`, `@ai-sdk/react`, `@shadcn/helpers`.
3. `components/dashboard/ask/demo-conversation.ts` — the script.
4. `components/dashboard/ask/ask-view.tsx` — thread + composer.
5. Routes + sidebar nav item (demo and dashboard).
6. Verify: typecheck, tests, static production build, browser click-through
   of all three exchanges on `/demo/ask`.

## Later (out of scope)

- **Live mode**: an `/api/ask` route on the AI SDK (AI Gateway) replacing
  `chat.transport()` — the UI contract (UIMessage parts) is already the AI
  SDK's, so only the transport changes. Needs prod env + prompt design over
  real ledger queries.
- **Attachment** component when answers carry evidence files.
