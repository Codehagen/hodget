import Link from "next/link"

const GITHUB_URL = "https://github.com/Codehagen/hodget"

const LINKS = [
  { label: "Blog", href: "/blog", external: false },
  { label: "Demo", href: "/demo", external: false },
  { label: "GitHub", href: GITHUB_URL, external: true },
  { label: "Waitlist", href: "/waitlist", external: false },
] as const

/**
 * Footer — wordmark, the four destinations, the actual license (AGPL-3.0, per
 * the repository LICENSE), and the copyright line.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-foreground/10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-heading text-base font-black tracking-tight text-foreground">
            hodget
          </span>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors duration-[var(--duration-instant)] hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition-colors duration-[var(--duration-instant)] hover:text-foreground"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-foreground/10 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Licensed under AGPL-3.0.</span>
          <span>© {new Date().getFullYear()} hodget</span>
        </div>
      </div>
    </footer>
  )
}
