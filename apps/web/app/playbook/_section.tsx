"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

const eyebrowCls =
  "font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground"

/** Shared playbook section scaffold (matches the sections in page.tsx). */
export function Section({
  id,
  index,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string
  index: string
  eyebrow: string
  title: string
  intro: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="max-w-[1080px] scroll-mt-8 border-b border-border/60 py-16"
    >
      <div className={cn(eyebrowCls, "mb-3")}>
        {index} · {eyebrow}
      </div>
      <h2 className="mb-3.5 font-heading text-[34px] font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mb-10 max-w-[620px] text-[15.5px] leading-relaxed text-muted-foreground">
        {intro}
      </p>
      {children}
    </section>
  )
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
      {children}
    </div>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-none border border-border bg-muted px-1.5 py-px font-mono text-[13px] text-foreground">
      {children}
    </code>
  )
}

/** A bordered tile: a centered demo area + a mono caption. Use for each demo. */
export function DemoTile({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-col overflow-hidden border border-border">
      <div
        className={cn(
          "flex min-h-28 flex-1 flex-wrap items-center justify-center gap-3 bg-muted/40 p-6",
          className
        )}
      >
        {children}
      </div>
      <div className="border-t border-border/60 px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground/70">
        {label}
      </div>
    </div>
  )
}

/** Responsive grid for demo tiles. */
export function DemoGrid({
  children,
  cols = 3,
}: {
  children: React.ReactNode
  cols?: 2 | 3
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {children}
    </div>
  )
}
