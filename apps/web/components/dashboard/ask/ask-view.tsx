"use client"

import * as React from "react"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import type { UIMessage } from "ai"
import { Area, AreaChart, XAxis, YAxis } from "recharts"

import { Badge } from "@workspace/ui/components/badge"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@workspace/ui/components/marker"
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
import {
  ChartContainer,
  chartAnimationProps,
  useChartAnimation,
  type ChartConfig,
} from "@workspace/ui/components/chart"

import { getRunDetail } from "../demo-data"
import { SectionHeader } from "../primitives"
import { createDemoConversation, type AskDataParts } from "./demo-conversation"

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
        title="Ask Hodget"
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
                    <MarkerContent>
                      Scripted conversation · Jul 13
                    </MarkerContent>
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
                        <AssistantTurn message={message} basePath={basePath} />
                      )}
                    </MessageScrollerItem>
                  ))
                )}

                {status === "submitted" ? (
                  <MessageScrollerItem>
                    <Marker>
                      <MarkerContent className="shimmer">
                        Thinking…
                      </MarkerContent>
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
    // Turn entrances fade opacity only — a transform would fight the
    // scroller's stick-to-bottom follow while the thread streams.
    <Message align="end" className="motion-safe:animate-fade-in">
      <MessageContent>
        <Bubble align="end">
          <BubbleContent>{textOf(message)}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/**
 * Assistant turns render part-by-part: reasoning as a collapsible thinking
 * block (live while streaming), tool activity as marker rows (shimmer while
 * running, a compact ledger line once resolved), data parts as inline
 * artifact cards, and text as a ghost bubble so answers read as content
 * rather than balloons.
 */
function AssistantTurn({
  message,
  basePath,
}: {
  message: UIMessage
  basePath: string
}) {
  return (
    <Message className="motion-safe:animate-fade-in">
      <MessageContent>
        <MessageHeader>Hodget</MessageHeader>
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <Bubble key={i} variant="ghost">
                <BubbleContent>{part.text}</BubbleContent>
              </Bubble>
            )
          }
          if (part.type === "reasoning") {
            return (
              <ReasoningBlock
                key={i}
                text={part.text}
                streaming={part.state === "streaming"}
              />
            )
          }
          if (part.type === "data-run_card") {
            return (
              <RunArtifactCard
                key={i}
                data={part.data as AskDataParts["run_card"]}
                basePath={basePath}
              />
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

/**
 * A reasoning part — the committee's visible thinking. Streams live (shimmer
 * label + text as it arrives), then collapses to a quiet toggle so finished
 * answers lead with the conclusion, not the deliberation.
 */
function ReasoningBlock({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const expanded = streaming || open

  return (
    <div className="flex flex-col gap-1">
      {streaming ? (
        <span className="w-fit shimmer text-[11px] text-muted-foreground">
          Thinking…
        </span>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-fit items-center gap-1 text-[11px] text-muted-foreground transition-colors duration-[var(--duration-instant)] hover:text-foreground"
        >
          <HugeiconsIcon
            icon={open ? ArrowDown01Icon : ArrowRight01Icon}
            size={12}
            strokeWidth={2}
          />
          Thought process
        </button>
      )}
      {expanded && text ? (
        // Entry-only fade: the conditional render can't animate its exit, and
        // a one-sided fade is proportionate for a quiet disclosure.
        <p className="border-l border-border pl-2.5 text-xs/relaxed text-muted-foreground italic motion-safe:animate-fade-in">
          {text}
        </p>
      ) : null}
    </div>
  )
}

const runCardChartConfig = {
  index: { label: "Equity (indexed)", color: "var(--chart-5)" },
} satisfies ChartConfig

/**
 * Inline artifact card for a `run_card` data part: the run's equity curve
 * (resolved from the fixtures by run id, rebased to 100) over its realized
 * metrics, linking to the full run page. Follows the recharts contract
 * (Design.md §7): series take `isAnimationActive` from useChartAnimation and
 * the chart root is keyed on the same value.
 */
function RunArtifactCard({
  data,
  basePath,
}: {
  data: AskDataParts["run_card"]
  basePath: string
}) {
  const isAnimationActive = useChartAnimation()
  const rows = React.useMemo(() => {
    const equity = getRunDetail(data.runId)?.equity ?? []
    const first = equity[0]?.equity ?? 1
    return equity.map((p) => ({
      date: p.date,
      index: (p.equity / first) * 100,
    }))
  }, [data.runId])

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-none bg-background p-3 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {data.strategy}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {data.runId} · backtest
        </span>
      </div>

      <ChartContainer
        key={isAnimationActive ? "animated" : "static"}
        config={runCardChartConfig}
        className="h-20 w-full"
      >
        <AreaChart
          data={rows}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis dataKey="date" hide />
          {/* Tight domain: the rebased index moves a few points around 100, so
              an auto [0, max] domain would flatten the line into a block. */}
          <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
          <Area
            dataKey="index"
            type="monotone"
            stroke="var(--color-index)"
            fill="var(--color-index)"
            fillOpacity={0.08}
            strokeWidth={1.5}
            isAnimationActive={isAnimationActive}
            {...chartAnimationProps}
          />
        </AreaChart>
      </ChartContainer>

      <dl className="grid grid-cols-4 gap-2">
        {(
          [
            ["Sharpe", data.sharpe.toFixed(2)],
            ["CAGR", `+${data.cagrPct.toFixed(1)}%`],
            ["Max DD", `${data.maxDrawdownPct.toFixed(1)}%`],
            ["Hit rate", `${data.hitRatePct.toFixed(0)}%`],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-[10px] text-muted-foreground">{label}</dt>
            <dd className="font-mono text-xs font-semibold text-foreground tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <Link
        href={`${basePath}/runs/${data.runId}`}
        className="w-fit text-[11px] text-muted-foreground underline underline-offset-2 transition-colors duration-[var(--duration-instant)] hover:text-foreground"
      >
        Open the full run →
      </Link>
    </div>
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
