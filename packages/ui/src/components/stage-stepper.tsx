import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * StageStepper — the Data → Analysts → Committee → Risk → Fills pipeline stepper.
 *
 * Three layouts cover every appearance in the engine surfaces, all driven by one
 * `steps` array:
 *   • horizontal + labels="below"  — the dashboard "Active run" header
 *   • horizontal + labels="inline" — the run-detail header rail
 *   • vertical (compact)           — the runs inspector "Current stage" list
 *
 * State semantics (per Design.md's finance palette): complete = solid green
 * check, active = blue ring + number, pending = muted number. The connector
 * *leaving* a node is solid when that node is complete and dashed otherwise, so
 * "progress so far" reads as one continuous solid line.
 */

type StageState = "complete" | "active" | "pending"

type StageStep = {
  id: string
  label: string
  state: StageState
  /** Small line under/next to the label, e.g. "Processing", "Pending". */
  caption?: string
  /** Number shown in the node for active/pending states. Defaults to position. */
  index?: number | string
}

const NODE_SIZE = {
  default: "size-7 text-[11px]",
  compact: "size-6 text-[10px]",
} as const

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5", className)}
      aria-hidden
    >
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  )
}

function StageNode({
  step,
  fallbackIndex,
  size,
}: {
  step: StageStep
  fallbackIndex: number
  size: keyof typeof NODE_SIZE
}) {
  const label = step.index ?? fallbackIndex
  return (
    <span
      data-slot="stage-node"
      data-state={step.state}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border font-mono font-medium tabular-nums",
        NODE_SIZE[size],
        step.state === "complete" &&
          "border-success bg-success text-success-foreground",
        step.state === "active" &&
          "border-2 border-info bg-background text-info",
        step.state === "pending" &&
          "border-border bg-background text-muted-foreground"
      )}
    >
      {step.state === "complete" ? <CheckIcon /> : label}
    </span>
  )
}

/** Connector line whose style is decided by the node it leaves. */
function connectorClass(leftState: StageState | undefined) {
  return leftState === "complete"
    ? "border-success"
    : "border-dashed border-border"
}

function StageLabel({
  step,
  align,
  active,
}: {
  step: StageStep
  align: "center" | "start"
  active: boolean
}) {
  return (
    <div className={cn("flex flex-col", align === "center" && "items-center")}>
      <span className="text-xs font-medium text-foreground">{step.label}</span>
      {step.caption ? (
        <span
          className={cn(
            "text-[11px]",
            active ? "text-info" : "text-muted-foreground"
          )}
        >
          {step.caption}
        </span>
      ) : null}
    </div>
  )
}

function StageStepper({
  steps,
  orientation = "horizontal",
  labels = "below",
  size,
  className,
  ...props
}: Omit<React.ComponentProps<"ol">, "children"> & {
  steps: readonly StageStep[]
  orientation?: "horizontal" | "vertical"
  /** Only applies to horizontal orientation. */
  labels?: "below" | "inline"
  size?: keyof typeof NODE_SIZE
}) {
  const resolvedSize: keyof typeof NODE_SIZE =
    size ?? (orientation === "vertical" ? "compact" : "default")

  if (orientation === "vertical") {
    return (
      <ol
        data-slot="stage-stepper"
        className={cn("flex flex-col", className)}
        {...props}
      >
        {steps.map((step, i) => {
          const last = i === steps.length - 1
          return (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StageNode step={step} fallbackIndex={i + 1} size={resolvedSize} />
                {!last ? (
                  <span
                    className={cn(
                      "my-1 w-0 flex-1 border-l",
                      connectorClass(step.state)
                    )}
                  />
                ) : null}
              </div>
              <div className={cn("pt-0.5", !last && "pb-3")}>
                <StageLabel
                  step={step}
                  align="start"
                  active={step.state === "active"}
                />
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  if (labels === "inline") {
    return (
      <ol
        data-slot="stage-stepper"
        className={cn("flex items-center", className)}
        {...props}
      >
        {steps.map((step, i) => {
          const last = i === steps.length - 1
          return (
            <li
              key={step.id}
              className={cn("flex items-center gap-2", !last && "flex-1")}
            >
              <StageNode step={step} fallbackIndex={i + 1} size={resolvedSize} />
              <StageLabel
                step={step}
                align="start"
                active={step.state === "active"}
              />
              {!last ? (
                <span
                  className={cn(
                    "mx-2 flex-1 border-t",
                    connectorClass(step.state)
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    )
  }

  // horizontal + labels below: split connectors keep labels aligned under nodes.
  return (
    <ol
      data-slot="stage-stepper"
      className={cn("flex items-start", className)}
      {...props}
    >
      {steps.map((step, i) => {
        const first = i === 0
        const last = i === steps.length - 1
        return (
          <li key={step.id} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "flex-1 border-t",
                  first ? "border-transparent" : connectorClass(steps[i - 1]?.state)
                )}
              />
              <StageNode step={step} fallbackIndex={i + 1} size={resolvedSize} />
              <span
                className={cn(
                  "flex-1 border-t",
                  last ? "border-transparent" : connectorClass(step.state)
                )}
              />
            </div>
            <StageLabel
              step={step}
              align="center"
              active={step.state === "active"}
            />
          </li>
        )
      })}
    </ol>
  )
}

export { StageStepper }
export type { StageStep, StageState }
