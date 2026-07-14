import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

import { formatSignedNumber, pnlToneClass } from "../format"
import { StatusPill } from "../primitives"
import { CopyButton } from "../run-detail/copy-button"
import type { DecisionMap, SummaryView } from "./data"

/* ------------------------------------------------------------------ */
/* Small presentational bits                                           */
/* ------------------------------------------------------------------ */

/** The panel surface shared by every card on the page. */
const PANEL = "rounded-none bg-card ring-1 ring-foreground/10"

/** A continuous mini signal bar — width ∝ |conviction|, colored by sign. */
function SignalBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.abs(value)) * 100)
  return (
    <div className="h-1.5 w-24 bg-muted" aria-hidden>
      <span
        className={cn(
          "block h-full",
          value >= 0 ? "bg-success" : "bg-destructive"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** One advisor view — name + kind pill, thesis, signed conviction, mini bar. */
function ViewRow({ view }: { view: SummaryView }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">
            {view.name}
          </span>
          <span className="text-muted-foreground">·</span>
          <StatusPill status={view.kind} />
        </div>
        <p className="text-xs/relaxed text-muted-foreground">{view.thesis}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className={cn(
              "font-mono text-xs font-medium tabular-nums",
              pnlToneClass(view.conviction)
            )}
          >
            {formatSignedNumber(view.conviction)}
          </span>
          <span className="text-xs text-muted-foreground">{view.word}</span>
        </span>
        <SignalBar value={view.conviction} />
      </div>
    </div>
  )
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-sm font-semibold text-foreground">
      {children}
    </h2>
  )
}

/* ------------------------------------------------------------------ */
/* The three explanation cards                                         */
/* ------------------------------------------------------------------ */

function WhyCard({ summary }: { summary: DecisionMap["summary"] }) {
  const { why } = summary
  return (
    <section className={cn(PANEL, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-col gap-1">
        <CardTitle>{why.title}</CardTitle>
        <p className="text-xs/relaxed text-muted-foreground">{why.intro}</p>
      </div>
      <div className="flex flex-col gap-4">
        {why.views.map((view) => (
          <ViewRow key={view.name} view={view} />
        ))}
      </div>
      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        {why.footer}
      </p>
    </section>
  )
}

function DisagreedCard({ summary }: { summary: DecisionMap["summary"] }) {
  const { disagreed } = summary
  return (
    <section className={cn(PANEL, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-col gap-1">
        <CardTitle>What disagreed</CardTitle>
        <p className="text-xs/relaxed text-muted-foreground">
          {disagreed ? disagreed.intro : "No dissent was recorded."}
        </p>
      </div>
      {disagreed ? (
        <>
          <ViewRow view={disagreed.view} />
          <p className="border-t border-dashed border-border pt-3 text-xs/relaxed text-muted-foreground">
            {disagreed.note}
          </p>
        </>
      ) : null}
    </section>
  )
}

/** The proposed → approved sizing arrow, mono + tabular. */
function Arrow() {
  return (
    <HugeiconsIcon
      icon={ArrowRight01Icon}
      size={16}
      className="shrink-0 text-muted-foreground"
    />
  )
}

function SafetyCard({ summary }: { summary: DecisionMap["summary"] }) {
  const { safety } = summary
  const hasSizing = safety.proposedPct != null
  const blocked = safety.tag?.tone === "destructive"
  const approvedTone = blocked ? "text-destructive" : "text-success"

  return (
    <section className={cn(PANEL, "flex flex-col gap-4 p-5")}>
      <CardTitle>What safety changed</CardTitle>

      {hasSizing ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2">
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Proposed
          </span>
          <span />
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Approved
          </span>

          <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
            {safety.proposedPct!.toFixed(2)}%
          </span>
          <Arrow />
          <span
            className={cn(
              "font-mono text-lg font-semibold tabular-nums",
              approvedTone
            )}
          >
            {safety.approvedPct!.toFixed(2)}%
          </span>

          <span className="font-mono text-sm font-medium text-success tabular-nums">
            {safety.proposedSide} {safety.proposedSize}
          </span>
          <Arrow />
          <span
            className={cn(
              "font-mono text-sm font-medium tabular-nums",
              approvedTone
            )}
          >
            {blocked || safety.approvedSize === 0
              ? "No fill"
              : `${safety.approvedSide} ${safety.approvedSize}`}
          </span>
        </div>
      ) : (
        <p className="text-xs/relaxed text-muted-foreground">
          No position to size — {safety.reason.toLowerCase()}.
        </p>
      )}

      {safety.tag ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-5 w-fit items-center rounded-none border px-2 text-xs font-medium",
              safety.tag.tone === "destructive"
                ? "border-destructive/40 text-destructive"
                : "border-warning/50 text-warning"
            )}
          >
            {safety.tag.label}
          </span>
          <span className="text-xs text-muted-foreground">
            Reason:{" "}
            <span className="text-foreground">{safety.reason}</span>
          </span>
        </div>
      ) : hasSizing ? (
        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-success">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />
          Within safety limits
        </span>
      ) : null}

      {safety.deterministic ? (
        <span className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <HugeiconsIcon
            icon={Shield01Icon}
            size={14}
            className="shrink-0 text-muted-foreground"
          />
          <span>
            <span className="text-foreground">Deterministic rule</span> · an
            analyst cannot override it.
          </span>
        </span>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* What happened next — horizontal timeline                            */
/* ------------------------------------------------------------------ */

function TimelineCard({ summary }: { summary: DecisionMap["summary"] }) {
  const { timeline } = summary
  const inset = `${50 / timeline.length}%`
  return (
    <section className={cn(PANEL, "flex flex-col gap-5 p-5")}>
      <CardTitle>What happened next</CardTitle>
      <div className="relative">
        {/* Connecting line, masked behind each node's ring. */}
        <div
          className="absolute top-2.5 h-px bg-info"
          style={{ left: inset, right: inset }}
          aria-hidden
        />
        <ol className="relative flex items-start">
          {timeline.map((step, i) => (
            <li
              key={`${step.label}-${i}`}
              className="flex flex-1 flex-col items-center gap-2 px-1 text-center"
            >
              <span className="flex size-5 items-center justify-center bg-background">
                {step.done ? (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={20}
                    className="text-success"
                  />
                ) : (
                  <span className="size-2.5 rounded-full bg-info ring-4 ring-background" />
                )}
              </span>
              <div className="flex flex-col gap-0.5">
                {step.time ? (
                  <span className="font-mono text-xs text-foreground tabular-nums">
                    {step.time}
                  </span>
                ) : null}
                <span className="max-w-[11ch] text-xs text-muted-foreground">
                  {step.label}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* CTA band                                                            */
/* ------------------------------------------------------------------ */

function CtaBand({
  onNavigate,
}: {
  onNavigate: (tab: "full" | "evidence") => void
}) {
  return (
    <section
      className={cn(
        PANEL,
        "flex flex-wrap items-center justify-between gap-5 p-5"
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Need the complete explanation?
          </h3>
          <p className="max-w-md text-xs/relaxed text-muted-foreground">
            Inspect every data source, advisor view, committee weight, risk
            rule, and fill.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("full")}
          >
            View full decision path
          </Button>
          <button
            type="button"
            onClick={() => onNavigate("evidence")}
            className="text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            Open evidence
          </button>
        </div>
      </div>
      <div className="flex max-w-xs items-start gap-2 text-xs/relaxed text-muted-foreground">
        <HugeiconsIcon
          icon={Shield01Icon}
          size={15}
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <p>
          Views form opinions. Deterministic code sizes, limits, and executes
          trades.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Collapsible detail rows                                             */
/* ------------------------------------------------------------------ */

function ProvenanceRow({
  label,
  value,
  copy,
}: {
  label: string
  value: React.ReactNode
  copy?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
        {value}
        {copy ? <CopyButton value={copy} /> : null}
      </span>
    </div>
  )
}

function DetailRows({ map }: { map: DecisionMap }) {
  const lead =
    map.analysts.find((a) => a.analystId === map.primaryAnalystId) ??
    map.analysts[0]!

  return (
    <div className={cn(PANEL, "px-5")}>
      <Accordion className="w-full">
        <AccordionItem value="evidence">
          <AccordionTrigger className="py-3.5 text-xs">
            Top evidence ({lead.evidence.length})
          </AccordionTrigger>
          <AccordionContent>
            <ul className="flex flex-col gap-2 pb-1">
              {lead.evidence.map((ev) => (
                <li
                  key={ev.title}
                  className="flex items-start gap-2 border border-border bg-muted/30 p-2.5"
                >
                  <HugeiconsIcon
                    icon={File01Icon}
                    size={14}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs/relaxed text-foreground">
                      {ev.title}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {ev.time}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ev.source}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="provenance">
          <AccordionTrigger className="py-3.5 text-xs">
            Technical provenance
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 pb-1 sm:grid-cols-2">
              <ProvenanceRow
                label="Context"
                value={lead.renderedContext}
                copy={lead.renderedContext}
              />
              <ProvenanceRow
                label="Prompt"
                value={lead.prompt}
                copy={lead.prompt !== "—" ? lead.prompt : undefined}
              />
              <ProvenanceRow label="Model" value={lead.model} copy={lead.model} />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">
                  Parse verified
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />
                  {lead.parseVerified ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="identifiers" className="border-b-0">
          <AccordionTrigger className="py-3.5 text-xs">
            Decision identifiers
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 pb-1 sm:grid-cols-3">
              <ProvenanceRow label="Decision id" value={map.id} copy={map.id} />
              <ProvenanceRow label="Run id" value={map.runId} copy={map.runId} />
              <ProvenanceRow
                label="Ledger id"
                value={map.execution?.ledgerId ?? "—"}
                copy={map.execution?.ledgerId}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Summary tab                                                         */
/* ------------------------------------------------------------------ */

/**
 * The "Summary-first" tab — a plain-language read of the whole decision,
 * derived entirely from `map.summary` (built in data.ts), so it can never
 * disagree with the Full decision path canvas. The CTA band switches the parent
 * Tabs to the full path or the evidence table via `onNavigate`.
 */
export function SummaryTab({
  map,
  onNavigate,
}: {
  map: DecisionMap
  onNavigate: (tab: "full" | "evidence") => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <WhyCard summary={map.summary} />
        <DisagreedCard summary={map.summary} />
        <SafetyCard summary={map.summary} />
      </div>
      <TimelineCard summary={map.summary} />
      <CtaBand onNavigate={onNavigate} />
      <DetailRows map={map} />
    </div>
  )
}
