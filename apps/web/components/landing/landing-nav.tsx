import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { GithubIcon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"

const GITHUB_URL = "https://github.com/Codehagen/hodget"

/**
 * Landing top bar — one line, ~64px. Wordmark left; navigation and the primary
 * waitlist CTA right. Sticky with a hairline underline and a translucent
 * backdrop so content reads under it while scrolling. No logo wall, no scroll
 * cues — just the handful of destinations.
 */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-base font-black tracking-tight text-foreground"
        >
          hodget
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/#how-it-works" />}
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            How it works
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/blog" />}
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Blog
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="hodget on GitHub"
            render={
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" />
            }
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={GithubIcon} size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/sign-in" />}
            className="text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Button>
          <Button size="sm" render={<Link href="/waitlist" />}>
            Join the waitlist
          </Button>
        </div>
      </nav>
    </header>
  )
}
