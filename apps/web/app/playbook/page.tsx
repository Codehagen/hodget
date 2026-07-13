"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"

import { PlaybookDataTable } from "./data-table-demo"
import { RUN_STATUSES, RunStatusBadge } from "./runs"
import { OverlaysSection } from "./_sections/overlays"
import { NavigationSection } from "./_sections/navigation"
import { FormControlsSection } from "./_sections/form-controls"
import { FeedbackSection } from "./_sections/feedback"
import { EmptyItemSection } from "./_sections/empty-item"
import { PageTemplatesSection } from "./_sections/page-templates"
import { UploadSection } from "./_sections/upload"
import { OtpSection } from "./_sections/otp"
import { TreeSection } from "./_sections/tree"
import { TimelineSection } from "./_sections/timeline"
import { ScoreSection } from "./_sections/score"
import { ChartsSection } from "./_sections/charts"

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const NAV = [
  { id: "colors", label: "Color tokens" },
  { id: "type", label: "Typography" },
  { id: "foundations", label: "Radii, shadows & spacing" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "forms", label: "Inputs & forms" },
  { id: "alerts", label: "Alerts" },
  { id: "data-table", label: "Data table" },
  { id: "motion", label: "Animations & motion" },
  { id: "overlays", label: "Overlays" },
  { id: "navigation", label: "Navigation & disclosure" },
  { id: "form-controls", label: "Form controls" },
  { id: "feedback", label: "Feedback & status" },
  { id: "empty-item", label: "Empty states & items" },
  { id: "templates", label: "Page templates" },
  { id: "upload", label: "File upload" },
  { id: "input-otp", label: "One-time code" },
  { id: "tree", label: "Tree & folders" },
  { id: "timeline", label: "Timeline" },
  { id: "score", label: "Score" },
  { id: "charts", label: "Charts" },
]

const EASINGS = [
  {
    name: "ease-out-quart",
    note: "entrances (default)",
    cls: "animate-[track_1.5s_var(--ease-out-quart)_infinite_alternate]",
  },
  {
    name: "ease-out-expo",
    note: "long, dramatic",
    cls: "animate-[track_1.5s_var(--ease-out-expo)_infinite_alternate]",
  },
  {
    name: "ease-in-out-cubic",
    note: "moves & returns",
    cls: "animate-[track_1.5s_var(--ease-in-out-cubic)_infinite_alternate]",
  },
  {
    name: "ease-ios-sheet",
    note: "sheets & drawers",
    cls: "animate-[track_1.5s_var(--ease-ios-sheet)_infinite_alternate]",
  },
] as const

const DURATIONS = [
  { token: "--duration-instant", ms: 100 },
  { token: "--duration-fast", ms: 150 },
  { token: "--duration-base", ms: 200 },
  { token: "--duration-slow", ms: 300 },
  { token: "--duration-page", ms: 400 },
] as const

const MOTION_ENTRANCES = [
  { name: "fade-in", cls: "animate-fade-in", dur: "0.2s · base" },
  { name: "scale-in", cls: "animate-scale-in", dur: "0.2s · base" },
  { name: "fade-in-blur", cls: "animate-fade-in-blur", dur: "0.3s · slow" },
  { name: "slide-up-fade", cls: "animate-slide-up-fade", dur: "0.4s · page" },
  { name: "slide-right-fade", cls: "animate-slide-right-fade", dur: "0.4s · page" },
] as const

const MOTION_FEEDBACK = [
  { name: "wiggle", cls: "animate-wiggle", dur: "0.75s loop" },
  { name: "pulse", cls: "animate-pulse", dur: "2s loop" },
  { name: "blink", cls: "animate-blink", dur: "1.4s loop" },
  { name: "spinner", cls: "animate-spin", dur: "1s loop" },
] as const

const SURFACES = [
  { cls: "bg-background", token: "--background" },
  { cls: "bg-card", token: "--card" },
  { cls: "bg-muted", token: "--muted" },
  { cls: "bg-secondary", token: "--secondary" },
  { cls: "bg-accent", token: "--accent" },
  { cls: "bg-primary", token: "--primary" },
]

const CONTENT = [
  { cls: "text-foreground", token: "--foreground", on: "bg-background" },
  { cls: "text-muted-foreground", token: "--muted-foreground", on: "bg-background" },
  { cls: "text-secondary-foreground", token: "--secondary-foreground", on: "bg-secondary" },
  { cls: "text-primary-foreground", token: "--primary-foreground", on: "bg-primary" },
]

const BORDERS = [
  { cls: "border-border", token: "--border" },
  { cls: "border-input", token: "--input" },
  { cls: "border-ring", token: "--ring" },
]

const ACCENTS = [
  { cls: "bg-destructive", token: "--destructive" },
  { cls: "bg-chart-1", token: "--chart-1" },
  { cls: "bg-chart-2", token: "--chart-2" },
  { cls: "bg-chart-3", token: "--chart-3" },
  { cls: "bg-chart-4", token: "--chart-4" },
  { cls: "bg-chart-5", token: "--chart-5" },
]

const RADII = [
  { cls: "rounded-sm", meta: "radius · 0.6" },
  { cls: "rounded-md", meta: "radius · 0.8" },
  { cls: "rounded-lg", meta: "radius · 1.0" },
  { cls: "rounded-xl", meta: "radius · 1.4" },
  { cls: "rounded-2xl", meta: "radius · 1.8" },
  { cls: "rounded-full", meta: "pills · avatars" },
]

const SHADOWS = [
  { cls: "shadow-sm", meta: "cards" },
  { cls: "shadow-md", meta: "dropdowns" },
  { cls: "shadow-lg", meta: "popovers, dialogs" },
]

const SPACING = [
  { cls: "w-1", px: "4px" },
  { cls: "w-2", px: "8px" },
  { cls: "w-3", px: "12px" },
  { cls: "w-4", px: "16px" },
  { cls: "w-6", px: "24px" },
  { cls: "w-10", px: "40px" },
  { cls: "w-14", px: "56px" },
]

const TYPE_SCALE = [
  { cls: "text-4xl", meta: "36 / 40" },
  { cls: "text-3xl", meta: "30 / 36" },
  { cls: "text-2xl", meta: "24 / 32" },
  { cls: "text-xl", meta: "20 / 28" },
  { cls: "text-lg", meta: "18 / 28" },
  { cls: "text-base", meta: "16 / 24" },
  { cls: "text-sm", meta: "14 / 20" },
  { cls: "text-xs", meta: "12 / 16" },
]

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const

const BADGE_STANDARD = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
] as const

const BADGE_COLORS = [
  { variant: "neutral", text: "Default" },
  { variant: "black", text: "New" },
  { variant: "blue", text: "Pro" },
  { variant: "violet", text: "Beta" },
  { variant: "green", text: "Active" },
  { variant: "red", text: "Error" },
  { variant: "amber", text: "Trial" },
  { variant: "sky", text: "Info" },
  { variant: "gray", text: "Draft" },
  { variant: "blueGradient", text: "Upgrade" },
  { variant: "rainbow", text: "AI" },
] as const

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const eyebrow =
  "font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground"
const kicker =
  "font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground"

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
      className="group/chip flex w-full items-center justify-between gap-2 border border-border bg-muted px-2.5 py-1.5 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="truncate">{value}</span>
      <span className="shrink-0 font-medium text-foreground group-hover/chip:text-accent-foreground">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  )
}

function Section({
  id,
  index,
  eyebrow: eb,
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
      className="max-w-[1080px] scroll-mt-8 border-b border-border/60 py-16 first:pt-10"
    >
      <div className={cn(eyebrow, "mb-3")}>
        {index} · {eb}
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

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className={cn(kicker, "mb-4")}>{children}</div>
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PlaybookPage() {
  const [showPw, setShowPw] = React.useState(false)
  const [paperTrading, setPaperTrading] = React.useState(true)
  const [publicAnalytics, setPublicAnalytics] = React.useState(false)

  return (
    <div className="flex min-h-screen bg-background text-foreground [-webkit-font-smoothing:antialiased]">
      <ThemeToggle />

      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] flex-none flex-col gap-7 self-start overflow-y-auto border-r border-border px-6 py-8 md:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-[30px] items-center justify-center rounded-lg bg-primary font-heading text-lg font-black text-primary-foreground">
            H
          </div>
          <div className="font-heading text-base font-bold tracking-tight">
            Hodget UI
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="rounded-md px-2.5 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto font-mono text-[10.5px] leading-relaxed text-muted-foreground/70">
          Hodget internal UI
          <br />
          shadcn · Base UI · Tailwind v4
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        <header className="max-w-[1080px] border-b border-border px-6 pt-20 pb-14 md:px-14">
          <div className={cn(eyebrow, "mb-5")}>Component Library · Brand Guide</div>
          <h1 className="mb-5 font-heading text-5xl font-black tracking-tight text-foreground md:text-6xl">
            The Hodget design system
          </h1>
          <p className="max-w-[620px] text-lg leading-relaxed text-muted-foreground">
            Our internal component library — colors, type, buttons, badges and
            forms — built on shadcn and Base UI with our own tokens. Every
            example is live; hover a code chip to copy the class.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {["Geist / Inter / Geist Mono", "Tailwind CSS v4", "OKLCH tokens"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </header>

        <div className="px-6 md:px-14">
          {/* 01 — Colors */}
          <Section
            id="colors"
            index="01"
            eyebrow="Foundations"
            title="Color tokens"
            intro={
              <>
                Semantic tokens are OKLCH CSS variables consumed through Tailwind
                utilities like <Code>bg-muted</Code> or{" "}
                <Code>text-muted-foreground</Code>. They flip automatically in
                dark mode.
              </>
            }
          >
            <Kicker>Surfaces</Kicker>
            <SwatchGrid>
              {SURFACES.map((s) => (
                <Swatch key={s.cls} label={s.cls} sub={s.token}>
                  <div className={cn("h-16 border-b border-border/60", s.cls)} />
                </Swatch>
              ))}
            </SwatchGrid>

            <Kicker>Content (text)</Kicker>
            <SwatchGrid>
              {CONTENT.map((c) => (
                <Swatch key={c.cls} label={c.cls} sub={c.token}>
                  <div
                    className={cn(
                      "flex h-16 items-center justify-center border-b border-border/60 font-heading text-2xl font-bold",
                      c.on,
                      c.cls
                    )}
                  >
                    Ag
                  </div>
                </Swatch>
              ))}
            </SwatchGrid>

            <Kicker>Borders</Kicker>
            <SwatchGrid>
              {BORDERS.map((b) => (
                <Swatch key={b.cls} label={b.cls} sub={b.token}>
                  <div className="flex h-16 items-center justify-center border-b border-border/60 bg-muted/40">
                    <div className={cn("h-0 w-3/5 border-t-2", b.cls)} />
                  </div>
                </Swatch>
              ))}
            </SwatchGrid>

            <Kicker>Accent & charts</Kicker>
            <SwatchGrid>
              {ACCENTS.map((a) => (
                <Swatch key={a.cls} label={a.cls} sub={a.token}>
                  <div className={cn("h-16 border-b border-border/60", a.cls)} />
                </Swatch>
              ))}
            </SwatchGrid>
          </Section>

          {/* 02 — Typography */}
          <Section
            id="type"
            index="02"
            eyebrow="Foundations"
            title="Typography"
            intro={
              <>
                Three families. <Strong>Geist</Strong> for display headings
                (<Code>font-heading</Code>), <Strong>Inter</Strong> for UI & body
                (<Code>font-sans</Code>), and <Strong>Geist Mono</Strong> for
                code and numerals (<Code>font-mono</Code>).
              </>
            }
          >
            <div className="mb-11 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FontCard family="Geist" token="font-heading" fontClass="font-heading" specimen="Ag" weights="400 · 500 · 700 · 900" sample="Compounding, on autopilot" heavy />
              <FontCard family="Inter" token="font-sans" fontClass="font-sans" specimen="Ag" weights="400 · 500 · 600 · 700" sample="The quick brown fox" />
              <FontCard family="Geist Mono" token="font-mono" fontClass="font-mono" specimen="Ag" weights="400 · 500 · 600" sample="run_9f2a10" />
            </div>

            <Kicker>Type scale</Kicker>
            <div className="overflow-hidden border border-border">
              {TYPE_SCALE.map((t) => (
                <div
                  key={t.cls}
                  className="flex items-baseline gap-6 border-b border-border/60 px-6 py-4 last:border-b-0"
                >
                  <div
                    className={cn(
                      "min-w-0 flex-1 truncate font-heading font-bold tracking-tight text-foreground",
                      t.cls
                    )}
                  >
                    Compounding, on autopilot
                  </div>
                  <div className="w-24 flex-none text-right font-mono text-xs text-muted-foreground">
                    {t.cls}
                  </div>
                  <div className="w-24 flex-none text-right font-mono text-xs text-muted-foreground/70">
                    {t.meta}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 03 — Radii, shadows & spacing */}
          <Section
            id="foundations"
            index="03"
            eyebrow="Foundations"
            title="Radii, shadows & spacing"
            intro={
              <>
                Radii derive from <Code>--radius</Code> (0.625rem). Spacing is a
                4px base scale. Shadows stay soft and functional.
              </>
            }
          >
            <Kicker>Border radius</Kicker>
            <SwatchGrid className="mb-11">
              {RADII.map((r) => (
                <div key={r.cls} className="border border-border p-4">
                  <div
                    className={cn(
                      "mb-3.5 h-16 border border-dashed border-border bg-muted",
                      r.cls
                    )}
                  />
                  <div className="font-mono text-xs text-foreground">{r.cls}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground/70">
                    {r.meta}
                  </div>
                </div>
              ))}
            </SwatchGrid>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Kicker>Shadows</Kicker>
                <div className="flex flex-col gap-3.5">
                  {SHADOWS.map((s) => (
                    <div
                      key={s.cls}
                      className="flex items-center gap-5 border border-border bg-muted/40 p-6"
                    >
                      <div className={cn("size-14 flex-none rounded-md bg-card", s.cls)} />
                      <div>
                        <div className="font-mono text-xs text-foreground">{s.cls}</div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground/70">
                          {s.meta}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Kicker>Spacing · 4px base</Kicker>
                <div className="flex flex-col gap-3 border border-border p-6">
                  {SPACING.map((s) => (
                    <div key={s.cls} className="flex items-center gap-4">
                      <span className="w-14 flex-none font-mono text-xs text-muted-foreground">
                        {s.cls}
                      </span>
                      <div className={cn("h-3 rounded-sm bg-primary", s.cls)} />
                      <span className="font-mono text-[11px] text-muted-foreground/70">
                        {s.px}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 04 — Buttons */}
          <Section
            id="buttons"
            index="04"
            eyebrow="Components"
            title="Buttons"
            intro={
              <>
                The shadcn <Code>Button</Code> — six variants and five sizes.
                Sharp corners, <Code>h-8</Code> default, <Code>text-xs</Code>.
                Hover any button; copy the variant below.
              </>
            }
          >
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BUTTON_VARIANTS.map((v) => (
                <div key={v} className="overflow-hidden border border-border">
                  <div className="flex items-center justify-center border-b border-border/60 bg-muted/40 px-6 py-8">
                    <Button variant={v}>
                      {v === "link" ? "View report" : "Run backtest"}
                    </Button>
                  </div>
                  <div className="p-3.5">
                    <div className="mb-2 font-mono text-xs font-semibold text-foreground">
                      {v}
                    </div>
                    <CopyChip value={`variant="${v}"`} />
                  </div>
                </div>
              ))}
            </div>

            <Kicker>Sizes & states</Kicker>
            <div className="flex flex-wrap items-center gap-4 border border-border bg-muted/40 p-7">
              <Button size="xs">xs</Button>
              <Button size="sm">sm</Button>
              <Button size="default">default</Button>
              <Button size="lg">lg</Button>
              <Button size="icon" aria-label="Add">
                <PlusIcon />
              </Button>
              <Button disabled>Disabled</Button>
              <Button variant="outline">
                Save
                <kbd className="rounded-none bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  ⌘S
                </kbd>
              </Button>
            </div>
          </Section>

          {/* 05 — Badges */}
          <Section
            id="badges"
            index="05"
            eyebrow="Components"
            title="Badges"
            intro={
              <>
                The shadcn <Code>Badge</Code> — the standard variants, plus a set
                of named color variants layered on top. Click a card to copy its
                variant.
              </>
            }
          >
            <Kicker>Standard</Kicker>
            <div className="mb-10 flex flex-wrap items-center gap-2.5">
              {BADGE_STANDARD.map((v) => (
                <Badge key={v} variant={v}>
                  {v}
                </Badge>
              ))}
            </div>

            <Kicker>Run status · with icons</Kicker>
            <div className="mb-10 flex flex-wrap items-center gap-2.5">
              {RUN_STATUSES.map((s) => (
                <RunStatusBadge key={s} status={s} />
              ))}
            </div>

            <Kicker>Color variants</Kicker>
            <SwatchGrid>
              {BADGE_COLORS.map((b) => (
                <div
                  key={b.variant}
                  className="flex flex-col items-center gap-3 border border-border bg-card px-4 pt-6 pb-4"
                >
                  <Badge variant={b.variant}>{b.text}</Badge>
                  <div className="font-mono text-xs text-foreground">
                    {b.variant}
                  </div>
                  <CopyChip value={`variant="${b.variant}"`} />
                </div>
              ))}
            </SwatchGrid>
          </Section>

          {/* 06 — Inputs & forms */}
          <Section
            id="forms"
            index="06"
            eyebrow="Components"
            title="Inputs & forms"
            intro={
              <>
                Text inputs are <Code>h-8</Code>, sharp, with a{" "}
                <Code>border-input</Code> resting border that gains a ring on
                focus. Checkbox and switch use <Code>--primary</Code> when
                active. Everything here is live.
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Text fields */}
              <div className="flex flex-col gap-5 border border-border p-7">
                <Field label="Workspace name" hint="default · focus:ring">
                  <Input placeholder="Hodget Capital" />
                </Field>

                <Field label="Password" hint="type=password · reveal toggle">
                  <div className="relative flex">
                    <Input
                      type={showPw ? "text" : "password"}
                      defaultValue="hodgethodget"
                      className="pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute inset-y-0 right-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </Field>

                <Field label="Run ID" hint="read-only · font-mono">
                  <Input readOnly defaultValue="run_9f2a10" className="font-mono" />
                </Field>

                <div>
                  <Label htmlFor="pb-email" className="mb-2">
                    Email
                  </Label>
                  <Input
                    id="pb-email"
                    aria-invalid
                    defaultValue="not-an-email"
                  />
                  <p className="mt-2 text-xs text-destructive">
                    Please enter a valid email address.
                  </p>
                  <div className="mt-1.5 font-mono text-[11px] text-muted-foreground/70">
                    error · aria-invalid
                  </div>
                </div>
              </div>

              {/* Selection controls */}
              <div className="flex flex-col gap-6 border border-border p-7">
                <Kicker>Selection controls</Kicker>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="pb-paper"
                    checked={paperTrading}
                    onCheckedChange={setPaperTrading}
                  />
                  <Label htmlFor="pb-paper" className="cursor-pointer">
                    Enable paper trading
                  </Label>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Public analytics
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted-foreground">
                      Anyone with the link can view this run&rsquo;s stats
                    </div>
                  </div>
                  <Switch
                    checked={publicAnalytics}
                    onCheckedChange={setPublicAnalytics}
                  />
                </div>

                <div className="flex flex-col gap-2 border-t border-border/60 pt-6">
                  <Disabled label="checkbox · size-4 · checked bg-primary">
                    <Checkbox defaultChecked disabled />
                  </Disabled>
                  <Disabled label="switch · h-5 w-9 · checked bg-primary">
                    <Switch defaultChecked disabled />
                  </Disabled>
                </div>
              </div>
            </div>
          </Section>

          {/* 07 — Alerts */}
          <Section
            id="alerts"
            index="07"
            eyebrow="Components"
            title="Alerts"
            intro={
              <>
                The shadcn <Code>Alert</Code> with{" "}
                <Code>AlertTitle</Code> / <Code>AlertDescription</Code> and an
                optional leading icon. Standard <Code>default</Code> and{" "}
                <Code>destructive</Code>, extended with info / success / warning.
              </>
            }
          >
            <div className="flex flex-col gap-3.5">
              <Alert>
                <HugeiconsIcon icon={InformationCircleIcon} size={16} />
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>
                  The default alert — neutral surface, subtle border. Use it for
                  general, non-blocking information.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <HugeiconsIcon icon={AlertCircleIcon} size={16} />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>
                  The destructive variant uses the destructive token for errors
                  and irreversible actions.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <Alert variant="info">
                  <HugeiconsIcon icon={InformationCircleIcon} size={16} />
                  <AlertTitle>Info</AlertTitle>
                  <AlertDescription>Contextual, low-urgency note.</AlertDescription>
                </Alert>
                <Alert variant="success">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>The run completed cleanly.</AlertDescription>
                </Alert>
                <Alert variant="warning">
                  <HugeiconsIcon icon={Alert02Icon} size={16} />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>Double-check before continuing.</AlertDescription>
                </Alert>
              </div>
            </div>
          </Section>

          {/* 08 — Data table */}
          <Section
            id="data-table"
            index="08"
            eyebrow="Components"
            title="Data table"
            intro={
              <>
                A data table on <Code>@tanstack/react-table</Code> — sortable
                headers, row selection with a bulk-action bar, a filter
                menu + pills, and pagination. This demo runs in memory over a
                static set of engine runs; the live, session-guarded version is
                wired through the runs API.
              </>
            }
          >
            <PlaybookDataTable />
          </Section>

          {/* 09 — Animations & motion */}
          <Section
            id="motion"
            index="09"
            eyebrow="Foundations"
            title="Animations & motion"
            intro={
              <>
                Motion is built on Emil Kowalski&rsquo;s easing blueprint and a
                five-step duration scale. Entrances favor{" "}
                <Code>ease-out-quart</Code>; feedback loops stay subtle. Every
                demo honors <Code>prefers-reduced-motion</Code>.
              </>
            }
          >
            <Kicker>Easing · the curve is the feel</Kicker>
            <div className="mb-11 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EASINGS.map((e) => (
                <div
                  key={e.name}
                  className="flex items-center gap-4 border border-border p-4"
                >
                  <div className="relative h-8 flex-1 overflow-hidden">
                    <div
                      className={cn(
                        "absolute top-1/2 left-0 size-3 -translate-y-1/2 rounded-full bg-primary motion-reduce:animate-none",
                        e.cls
                      )}
                    />
                  </div>
                  <div className="w-40 flex-none">
                    <div className="font-mono text-xs text-foreground">
                      {e.name}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground/70">
                      {e.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Kicker>Duration · 100 → 400ms</Kicker>
            <div className="mb-11 flex flex-col gap-3 border border-border p-6">
              {DURATIONS.map((d) => (
                <div key={d.token} className="flex items-center gap-4">
                  <span className="w-40 flex-none font-mono text-xs text-muted-foreground">
                    {d.token}
                  </span>
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: d.ms / 2 }}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground/70">
                    {d.ms}ms
                  </span>
                </div>
              ))}
            </div>

            <Kicker>Entrances · replay on loop</Kicker>
            <SwatchGrid>
              {MOTION_ENTRANCES.map((m) => (
                <div key={m.name} className="overflow-hidden border border-border">
                  <div className="flex h-24 items-center justify-center bg-muted/40">
                    <ReplayBox anim={m.cls}>
                      <div className="size-10 rounded-md border border-border bg-card shadow-sm" />
                    </ReplayBox>
                  </div>
                  <div className="p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {m.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground/70">
                        {m.dur}
                      </span>
                    </div>
                    <CopyChip value={m.cls} />
                  </div>
                </div>
              ))}
            </SwatchGrid>

            <Kicker>Feedback · continuous</Kicker>
            <SwatchGrid>
              {MOTION_FEEDBACK.map((m) => (
                <div key={m.name} className="overflow-hidden border border-border">
                  <div className="flex h-24 items-center justify-center bg-muted/40">
                    <FeedbackDemo name={m.name} cls={m.cls} />
                  </div>
                  <div className="p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {m.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground/70">
                        {m.dur}
                      </span>
                    </div>
                    <CopyChip value={m.cls} />
                  </div>
                </div>
              ))}
            </SwatchGrid>
          </Section>

          <OverlaysSection />
          <NavigationSection />
          <FormControlsSection />
          <FeedbackSection />
          <EmptyItemSection />
          <PageTemplatesSection />
          <UploadSection />
          <OtpSection />
          <TreeSection />
          <TimelineSection />
          <ScoreSection />
          <ChartsSection />

          <footer className="max-w-[1080px] py-12 font-mono text-[11px] text-muted-foreground/70">
            Hodget internal component library — extend as new patterns land.
          </footer>
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Leaf helpers                                                         */
/* ------------------------------------------------------------------ */

function SwatchGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-10 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3",
        className
      )}
    >
      {children}
    </div>
  )
}

function Swatch({
  label,
  sub,
  children,
}: {
  label: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden border border-border">
      {children}
      <div className="px-3 py-2.5">
        <div className="font-mono text-xs text-foreground">{label}</div>
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
          {sub}
        </div>
      </div>
    </div>
  )
}

function FontCard({
  family,
  token,
  fontClass,
  specimen,
  weights,
  sample,
  heavy,
}: {
  family: string
  token: string
  fontClass: string
  specimen: string
  weights: string
  sample: string
  heavy?: boolean
}) {
  return (
    <div className="border border-border p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <span className={cn("text-[15px] font-bold text-foreground", fontClass)}>
          {family}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/70">
          {token}
        </span>
      </div>
      <div
        className={cn(
          "text-[44px] leading-none tracking-tight text-foreground",
          fontClass,
          heavy ? "font-black" : "font-bold"
        )}
      >
        {specimen}
      </div>
      <div className={cn("mt-3.5 text-[15px] text-muted-foreground", fontClass)}>
        {sample}
      </div>
      <div className="mt-3.5 font-mono text-[11px] text-muted-foreground/70">
        {weights}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label className="mb-2">{label}</Label>
      {children}
      <div className="mt-2 font-mono text-[11px] text-muted-foreground/70">
        {hint}
      </div>
    </div>
  )
}

function Disabled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      {children}
      <span className="font-mono text-[11px] text-muted-foreground/70">
        {label}
      </span>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-none border border-border bg-muted px-1.5 py-px font-mono text-[13px] text-foreground">
      {children}
    </code>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>
}

/**
 * Floating light/dark toggle. The visible icon is driven by the `dark` class
 * via CSS (not JS state), so there's no hydration flash; the click uses
 * next-themes' resolvedTheme to flip. (The app also toggles on the "D" key.)
 */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      type="button"
      aria-label="Toggle light and dark mode"
      title="Toggle theme (or press D)"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="fixed top-4 right-4 z-50 flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
    >
      <HugeiconsIcon icon={Sun03Icon} size={18} className="hidden dark:block" />
      <HugeiconsIcon icon={Moon02Icon} size={18} className="block dark:hidden" />
    </button>
  )
}

/** SSR-safe read of the OS "Reduce motion" setting. */
function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}

/**
 * Replays a one-shot entrance animation on a loop for the gallery by remounting
 * the animated node on an interval. Honors prefers-reduced-motion: when the user
 * opts out, it renders the final state and never animates.
 */
function ReplayBox({
  anim,
  children,
}: {
  anim: string
  children: React.ReactNode
}) {
  const [tick, setTick] = React.useState(0)
  const reduced = usePrefersReducedMotion()

  React.useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1900)
    return () => window.clearInterval(id)
  }, [reduced])

  if (reduced) return <>{children}</>
  return (
    <div key={tick} className={anim}>
      {children}
    </div>
  )
}

function FeedbackDemo({ name, cls }: { name: string; cls: string }) {
  const motion = cn(cls, "motion-reduce:animate-none")
  if (name === "spinner") {
    return (
      <span
        className={cn(
          "size-6 rounded-full border-2 border-border border-t-primary",
          motion
        )}
      />
    )
  }
  if (name === "blink") {
    return <span className={cn("size-3 rounded-full bg-primary", motion)} />
  }
  if (name === "pulse") {
    return <span className={cn("h-3 w-16 rounded-full bg-primary", motion)} />
  }
  return (
    <span
      className={cn(
        "size-9 rounded-md border border-border bg-card shadow-sm",
        motion
      )}
    />
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-4">
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}
