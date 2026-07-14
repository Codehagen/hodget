"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, File01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

import { formatSignedNumber, pnlToneClass } from "../format"
import { CopyButton } from "../run-detail/copy-button"
import type { AnalystViewNodeData, DecisionMap } from "./data"

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

/**
 * The right rail — "Why did {advisor} say {conviction}?". It tracks whichever
 * advisor node is selected on the canvas (default: the lead view), showing the
 * evidence that advisor used and, in a collapsible provenance section, the
 * context / prompt / model that produced the view. Presentational — everything
 * comes from the derived map. Selecting is instant, so the rail swaps without
 * motion.
 */
export function AdvisorRail({
  advisor,
}: {
  map: DecisionMap
  advisor: AnalystViewNodeData
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 rounded-none bg-card p-4 text-card-foreground ring-1 ring-foreground/10 lg:w-72">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Why did {advisor.name} say{" "}
          <span className={cn("font-mono tabular-nums", pnlToneClass(advisor.conviction))}>
            {formatSignedNumber(advisor.conviction)}
          </span>
          ?
        </h2>
        <span className="text-xs text-muted-foreground">Top evidence used by this advisor</span>
      </div>

      <ul className="flex flex-col gap-2">
        {advisor.evidence.map((ev) => (
          <li key={ev.title} className="flex items-start gap-2 border border-border bg-muted/30 p-2.5">
            <HugeiconsIcon icon={File01Icon} size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs/relaxed text-foreground">{ev.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{ev.time}</span>
              <span className="text-[10px] text-muted-foreground">{ev.source}</span>
            </div>
          </li>
        ))}
      </ul>

      <Accordion className="w-full border-t border-border" defaultValue={["provenance"]}>
        <AccordionItem value="provenance" className="border-b-0">
          <AccordionTrigger className="hover:no-underline">Technical provenance</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 pt-1">
              <ProvenanceRow label="Context" value={advisor.renderedContext} copy={advisor.renderedContext} />
              <ProvenanceRow
                label="Prompt"
                value={advisor.prompt}
                copy={advisor.prompt !== "—" ? advisor.prompt : undefined}
              />
              <ProvenanceRow label="Model" value={advisor.model} copy={advisor.model} />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Parse verified</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />
                  {advisor.parseVerified ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button variant="outline" size="sm" className="w-full">
        Open full evidence
      </Button>
    </aside>
  )
}
