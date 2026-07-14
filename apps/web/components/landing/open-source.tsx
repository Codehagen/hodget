import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { RevealOnScroll } from "@/components/landing/reveal"

const GITHUB_URL = "https://github.com/Codehagen/hodget"

// Verbatim from packages/engine/src/risk/gates.ts (the per-name position cap),
// outdented from its block. This is the deterministic code that sizes and clips
// every position; it runs even at conviction 1.0 and no model output can bypass
// it.
const CODE = `const dynamicCap = volCap * corrMult
const effectiveCap = Math.min(cfg.maxPositionPct, dynamicCap)
const maxPos = Math.floor((effectiveCap * ctx.equityBase) / priceBase)
const held = ctx.heldQuantity(order.securityId)
const resulting = held + order.quantity
if (resulting <= maxPos) {
  afterPosition.push(order)
  continue
}
const gate = dynamicCap < cfg.maxPositionPct ? "vol-scaled-position" : "max-position"
const newQty = maxPos - held`

export function OpenSource() {
  return (
    <RevealOnScroll className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <h2 className="max-w-md text-balance font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Open source, end to end.
          </h2>
          <div className="flex max-w-md flex-col gap-3 text-lg text-muted-foreground">
            <p>The engine, the safety rules, and this site are all public.</p>
            <p>
              Read the exact code that sizes every position and applies every
              limit.
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            render={
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" />
            }
          >
            Star on GitHub
          </Button>
        </div>

        <div className="rounded-none bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto p-4 sm:p-5">
            <pre className="font-mono text-[13px] leading-relaxed text-foreground">
              <code>{CODE}</code>
            </pre>
          </div>
          <div className="border-t border-foreground/10 px-4 py-2.5 sm:px-5">
            <span className="font-mono text-xs text-muted-foreground">
              packages/engine/src/risk/gates.ts
            </span>
          </div>
        </div>
      </div>
    </RevealOnScroll>
  )
}
