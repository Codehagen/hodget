import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { DEFAULT_TODAY_ID, getTodayDecisionMap } from "@/components/dashboard/decision-map/data"
import { CanvasReveal } from "@/components/landing/canvas-reveal"
import { HowItWorks } from "@/components/landing/how-it-works"
import { IntroGate } from "@/components/landing/intro-gate"
import { LandingNav } from "@/components/landing/landing-nav"
import { constructMetadata, SITE_NAME } from "@/lib/metadata"

export const metadata = constructMetadata({
  description:
    "Hodget is an AI hedge fund engine: a committee of AI analysts debates every position, a deterministic risk gate can veto them, and every decision traces back to the evidence behind it.",
  canonicalUrl: "/",
})

const map = getTodayDecisionMap(DEFAULT_TODAY_ID)!

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <LandingNav />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-20 sm:py-24">
          <IntroGate className="flex flex-col gap-6">
            <h1 className="text-balance font-heading text-4xl font-black tracking-tight sm:text-5xl">
              An AI hedge fund engine that can explain every decision it makes.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              A committee of AI analysts debates each position, a deterministic
              risk gate sizes and can veto it, and every trade traces back to
              the evidence — end to end.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button render={<Link href="/waitlist" />}>
                Join the waitlist
              </Button>
              <Button variant="outline" render={<Link href="/demo" />}>
                Explore the live demo
              </Button>
              <Button variant="ghost" render={<Link href="/blog" />}>
                Read the blog
              </Button>
            </div>
          </IntroGate>
        </section>

        <section
          id="how-it-works"
          className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col px-6 pb-24"
        >
          <Tabs defaultValue="tree" className="w-full">
            <TabsList variant="line">
              <TabsTrigger value="tree">Decision tree</TabsTrigger>
              <TabsTrigger value="how">How it works</TabsTrigger>
            </TabsList>

            {/*
              keepMounted so the canvas stays in the DOM across tab switches —
              CanvasReveal's one-shot entrance gate lives in component state, so
              unmounting would replay the stagger every time this tab regains
              focus. Hidden panels get `hidden` (display:none), not unmounted.
            */}
            <TabsContent
              value="tree"
              keepMounted
              className="mt-6 flex flex-col gap-4 text-sm"
            >
              <div className="rounded-none bg-card p-4 ring-1 ring-foreground/10">
                <CanvasReveal map={map} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Every trade traces back to evidence — click any node.
                </p>
                <Link
                  href="/demo/decisions"
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  See it in the product →
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="how" className="mt-8 text-sm">
              <HowItWorks />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {SITE_NAME}
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="/waitlist"
              className="transition-colors duration-[var(--duration-instant)] hover:text-foreground"
            >
              Waitlist
            </Link>
            <Link
              href="/blog"
              className="transition-colors duration-[var(--duration-instant)] hover:text-foreground"
            >
              Blog
            </Link>
            <Link
              href="/demo"
              className="transition-colors duration-[var(--duration-instant)] hover:text-foreground"
            >
              Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
