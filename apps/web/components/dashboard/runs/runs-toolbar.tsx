"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Calendar03Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type { RunMode, RunStatus } from "../demo-data"

export type ModeFilter = "all" | RunMode
export type StatusFilter = "all" | RunStatus

const MODE_TABS: { value: ModeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "backtest", label: "Backtest" },
  { value: "paper", label: "Paper" },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
]

/** Bordered segmented control — the All / Backtest / Paper mode switch. */
function ModeTabs({
  value,
  onChange,
}: {
  value: ModeFilter
  onChange: (next: ModeFilter) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter by mode"
      className="inline-flex h-8 items-center border border-input p-0.5"
    >
      {MODE_TABS.map((tab) => {
        const active = value === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex h-full items-center px-3 text-xs font-medium transition-colors duration-[var(--duration-instant)]",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function RunsToolbar({
  query,
  onQueryChange,
  mode,
  onModeChange,
  status,
  onStatusChange,
  strategy,
  onStrategyChange,
  strategies,
  onReset,
}: {
  query: string
  onQueryChange: (next: string) => void
  mode: ModeFilter
  onModeChange: (next: ModeFilter) => void
  status: StatusFilter
  onStatusChange: (next: StatusFilter) => void
  strategy: string
  onStrategyChange: (next: string) => void
  strategies: readonly string[]
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
        <HugeiconsIcon
          icon={Search01Icon}
          size={14}
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search runs…"
          aria-label="Search runs"
          className="pl-8"
        />
      </div>

      <ModeTabs value={mode} onChange={onModeChange} />

      {/* Status */}
      <Select
        value={status}
        onValueChange={(next) => onStatusChange((next ?? "all") as StatusFilter)}
      >
        <SelectTrigger className="w-[9.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Strategies */}
      <Select
        value={strategy}
        onValueChange={(next) => onStrategyChange(next ?? "all")}
      >
        <SelectTrigger className="w-[10.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All strategies</SelectItem>
          {strategies.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range — presentational for the demo fixtures */}
      <div className="inline-flex h-8 items-center gap-2 border border-input px-2.5 text-xs text-muted-foreground">
        <HugeiconsIcon icon={Calendar03Icon} size={14} strokeWidth={2} />
        <span className="font-mono tabular-nums">2025-05-08</span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={2} />
        <span className="font-mono tabular-nums">2025-05-15</span>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="ml-auto inline-flex h-8 items-center px-2 text-xs font-medium text-muted-foreground transition-colors duration-[var(--duration-instant)] hover:text-foreground"
      >
        Reset
      </button>
    </div>
  )
}
