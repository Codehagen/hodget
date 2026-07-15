"use client"

import * as React from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import type { UIMessage } from "ai"

import { Badge } from "@workspace/ui/components/badge"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker"
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@workspace/ui/components/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"

import { SectionHeader } from "../primitives"
import { createDemoConversation } from "./demo-conversation"

/**
 * "Ask the fund" — the conversational surface (plan 006). A scripted
 * conversation streams through the real AI SDK `useChat` lifecycle
 * (@shadcn/helpers/ai-sdk transport), rendered with the shadcn chat
 * primitives: MessageScroller, Message, Bubble, and Marker. The composer is
 * the canonical read-only demo pattern — it offers the next scripted question
 * and Send streams it; visitors cannot type, because no model is listening.
 */
export function AskView({ basePath }: { basePath: string }) {
  // Remounting the thread is the reset: a fresh key rebuilds the script,
  // transport, and useChat state from the top.
  const [round, setRound] = React.useState(0)
  return (
    <AskThread
      key={round}
      basePath={basePath}
      onRestart={() => setRound((r) => r + 1)}
    />
  )
}

function AskThread({
  basePath,
  onRestart,
}: {
  basePath: string
  onRestart: () => void
}) {
  // One script + transport per mount; both are stateless between renders.
  const [chat] = React.useState(createDemoConversation)
  const [transport] = React.useState(() => chat.transport({ delayMs: 20 }))
  const { messages, sendMessage, status } = useChat({ transport })

  const nextMessage = chat.next(messages)
  const busy = status === "submitted" || status === "streaming"

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <SectionHeader
        title="Ask the fund"
        description="Plain-language answers about why the fund acted, grounded in the decision ledger."
        actions={<Badge variant="amber">Simulated — mock data</Badge>}
      />

      <div className="flex h-[min(42rem,calc(100svh-13rem))] min-h-[24rem] flex-col rounded-none bg-card ring-1 ring-foreground/10">
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent className="gap-4 p-4">
                <MessageScrollerItem>
                  <Marker variant="separator">
                    <MarkerContent>Scripted conversation · Jul 13</MarkerContent>
                  </Marker>
                </MessageScrollerItem>

                {messages.length === 0 ? (
                  <MessageScrollerItem>
                    <div className="flex flex-col items-center gap-1 py-10 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Why did the fund do that?
                      </p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        Every trade traces back to recorded analyst views,
                        committee weights, and risk-gate actions. Press Send to
                        ask the first question.
                      </p>
                    </div>
                  </MessageScrollerItem>
                ) : (
                  messages.map((message) => (
                    <MessageScrollerItem key={message.id}>
                      {message.role === "user" ? (
                        <UserTurn message={message} />
                      ) : (
                        <AssistantTurn message={message} />
                      )}
                    </MessageScrollerItem>
                  ))
                )}

                {status === "submitted" ? (
                  <MessageScrollerItem>
                    <Marker>
                      <MarkerContent className="shimmer">Thinking…</MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        <Composer
          nextText={nextMessage ? textOf(nextMessage) : null}
          busy={busy}
          onSend={() => {
            if (nextMessage && !busy) void sendMessage(nextMessage)
          }}
          onRestart={onRestart}
          basePath={basePath}
        />
      </div>
    </div>
  )
}

function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

function UserTurn({ message }: { message: UIMessage }) {
  return (
    <Message align="end">
      <MessageContent>
        <Bubble align="end">
          <BubbleContent>{textOf(message)}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/**
 * Assistant turns render part-by-part: tool activity as marker rows (shimmer
 * while running, a compact ledger line once resolved), text as a ghost bubble
 * so answers read as content rather than balloons.
 */
function AssistantTurn({ message }: { message: UIMessage }) {
  return (
    <Message>
      <MessageContent>
        <MessageHeader>Hodget committee</MessageHeader>
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <Bubble key={i} variant="ghost">
                <BubbleContent>{part.text}</BubbleContent>
              </Bubble>
            )
          }
          if (part.type === "tool-lookup_decision") {
            const resolved = part.state === "output-available"
            const output = resolved
              ? (part.output as {
                  security: string
                  date: string
                  committeeNet: number
                  targetWeightPct: number
                  gate: string
                  fill: string
                })
              : null
            return (
              <Marker key={i} variant="border" className="my-1">
                <MarkerIcon>
                  <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} />
                </MarkerIcon>
                {output ? (
                  <MarkerContent className="font-mono text-[11px]">
                    Ledger · {output.security} · {output.date} · net{" "}
                    {output.committeeNet > 0 ? "+" : ""}
                    {output.committeeNet} → target {output.targetWeightPct}% ·
                    gate: {output.gate} · {output.fill}
                  </MarkerContent>
                ) : (
                  <MarkerContent className="shimmer">
                    Reading the decision ledger…
                  </MarkerContent>
                )}
              </Marker>
            )
          }
          return null
        })}
      </MessageContent>
    </Message>
  )
}

function Composer({
  nextText,
  busy,
  onSend,
  onRestart,
  basePath,
}: {
  nextText: string | null
  busy: boolean
  onSend: () => void
  onRestart: () => void
  basePath: string
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      {nextText !== null ? (
        <>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              onSend()
            }}
          >
            <Input
              readOnly
              value={nextText}
              aria-label="Next scripted question"
              className="flex-1 text-muted-foreground"
            />
            <Button type="submit" disabled={busy} aria-label="Send">
              <HugeiconsIcon icon={SentIcon} size={14} strokeWidth={2} />
              Send
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground">
            Demo is read only — Send asks the next scripted question. Live
            questions arrive with the hosted engine.
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            End of the scripted conversation. The full decision trail lives on
            the{" "}
            <Link
              href={`${basePath}/decisions`}
              className="text-foreground underline underline-offset-2"
            >
              Decisions page
            </Link>
            .
          </p>
          <Button variant="outline" onClick={onRestart}>
            Restart
          </Button>
        </div>
      )}
    </div>
  )
}
