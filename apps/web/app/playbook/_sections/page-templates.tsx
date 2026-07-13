"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { PageHeader } from "@/app/playbook/_page-header"
import { Section } from "@/app/playbook/_section"
import { RunModeBadge, RunStatusBadge } from "@/app/playbook/runs"

/* ------------------------------------------------------------------ */
/* Mock app-window frame (static shell chrome for the previews)        */
/* ------------------------------------------------------------------ */

const NAV = ["Dashboard", "Runs", "Strategies", "Reports"]

function MockSidebar({ active }: { active: string }) {
  return (
    <aside className="hidden w-44 shrink-0 flex-col border-r border-border bg-sidebar p-2 md:flex">
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary font-heading text-xs font-black text-primary-foreground">
          H
        </div>
        <span className="font-heading text-sm font-bold">Hodget</span>
      </div>
      <div className="mt-3 px-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        Platform
      </div>
      <nav className="mt-1 flex flex-col gap-0.5">
        {NAV.map((item) => (
          <div
            key={item}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
              item === active
                ? "bg-sidebar-accent font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            <span className="size-3.5 rounded-sm bg-current opacity-40" />
            {item}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2 border-t border-border px-1.5 py-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
          U
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">User</div>
        </div>
      </div>
    </aside>
  )
}

function WindowFrame({
  label,
  active,
  children,
}: {
  label: string
  active: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col overflow-hidden border border-border">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex h-[420px]">
        <MockSidebar active={active} />
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="size-4 rounded-sm border border-border" />
            <span className="h-4 w-px bg-border" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const LIST_ROWS = [
  { id: "run_9f2a12", strategy: "Value + Quality Blend", mode: "backtest" as const, status: "completed" as const },
  { id: "run_9f2a11", strategy: "Mean Reversion · ETF", mode: "paper" as const, status: "running" as const },
  { id: "run_9f2a13", strategy: "Trend Following · Futures", mode: "paper" as const, status: "failed" as const },
]

function ListTemplate() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "#" }, { label: "Runs" }]}
        title="Runs"
        description="Search, filter, and sort a data table."
        actions={<Button size="sm">New run</Button>}
      />
      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Run</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {LIST_ROWS.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.id}
                </TableCell>
                <TableCell className="font-medium">{r.strategy}</TableCell>
                <TableCell>
                  <RunModeBadge mode={r.mode} />
                </TableCell>
                <TableCell>
                  <RunStatusBadge status={r.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function DetailTemplate() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: "Runs", href: "#" },
          { label: "run_9f2a12" },
        ]}
        title="Value + Quality Blend"
        description="Backtest · Jun 30, 2026 · 14:20 UTC"
        actions={
          <Button size="sm" variant="outline">
            Re-run
          </Button>
        }
      />
      <ItemGroup className="border border-border">
        <Item>
          <ItemContent>
            <ItemTitle>Mode</ItemTitle>
            <ItemDescription>Backtest</ItemDescription>
          </ItemContent>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemContent>
            <ItemTitle>Positions</ItemTitle>
            <ItemDescription>31</ItemDescription>
          </ItemContent>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">
            <span className="size-2 rounded-full bg-emerald-500" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Status</ItemTitle>
            <ItemDescription>Completed · Sharpe 2.14</ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>
    </div>
  )
}

function EmptyTemplate() {
  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader title="Reports" description="Export and scheduled reports." />
      <Empty className="flex-1 border border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="size-6"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" />
            </svg>
          </EmptyMedia>
          <EmptyTitle>No reports yet</EmptyTitle>
          <EmptyDescription>Create your first report to see it here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

function SettingsTemplate() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" description="Workspace and account." />
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="tpl-ws">Workspace name</FieldLabel>
          <Input id="tpl-ws" defaultValue="Hodget Capital" />
          <FieldDescription>Shown across the app.</FieldDescription>
        </Field>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <div className="text-sm font-medium">Email notifications</div>
            <div className="text-xs text-muted-foreground">
              Run summaries and alerts.
            </div>
          </div>
          <Button size="sm" variant="outline">
            Toggle
          </Button>
        </div>
        <div className="flex justify-end pt-2">
          <Button size="sm">Save changes</Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function PageTemplatesSection() {
  return (
    <Section
      id="templates"
      index="15"
      eyebrow="Templates"
      title="Page templates"
      intro={
        <>
          Full-page layouts inside the app shell — reuse these as starting points
          when building a new page. Each pairs a <code>PageHeader</code> with
          library components inside a shell frame.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WindowFrame label="List page" active="Runs">
          <ListTemplate />
        </WindowFrame>
        <WindowFrame label="Detail page" active="Runs">
          <DetailTemplate />
        </WindowFrame>
        <WindowFrame label="Empty page" active="Reports">
          <EmptyTemplate />
        </WindowFrame>
        <WindowFrame label="Settings page" active="Dashboard">
          <SettingsTemplate />
        </WindowFrame>
      </div>
    </Section>
  )
}
