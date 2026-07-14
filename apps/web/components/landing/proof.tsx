import Image from "next/image"
import Link from "next/link"

import { RevealOnScroll } from "@/components/landing/reveal"

/**
 * Proof — two real product screenshots in an asymmetric 3fr / 2fr grid. The
 * captures are the actual /demo pages (decision explainer + fund overview),
 * rendered with explicit dimensions so the frames reserve their space and never
 * shift. Each caption links to the live page it was taken from.
 */
const SHOTS = [
  {
    src: "/screenshots/decisions-summary.png",
    alt: "The hodget decision explainer, showing why a trade was made and what safety changed.",
    caption: "The decision explainer.",
    href: "/demo/decisions",
    sizes: "(min-width: 1024px) 55vw, 100vw",
  },
  {
    src: "/screenshots/fund-overview.png",
    alt: "The hodget fund overview, showing holdings, performance, and risk.",
    caption: "The fund overview.",
    href: "/demo",
    sizes: "(min-width: 1024px) 38vw, 100vw",
  },
] as const

export function Proof() {
  return (
    <RevealOnScroll className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
      <h2 className="max-w-2xl text-balance font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
        See exactly what it did.
      </h2>

      <div className="mt-12 grid gap-8 lg:grid-cols-[3fr_2fr]">
        {SHOTS.map((shot) => (
          <figure key={shot.href} className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-none bg-card ring-1 ring-foreground/10">
              <Image
                src={shot.src}
                alt={shot.alt}
                width={1600}
                height={1000}
                sizes={shot.sizes}
                className="h-auto w-full"
              />
            </div>
            <figcaption>
              <Link
                href={shot.href}
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                {shot.caption}
              </Link>
            </figcaption>
          </figure>
        ))}
      </div>
    </RevealOnScroll>
  )
}
