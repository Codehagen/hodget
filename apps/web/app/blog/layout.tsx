import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { SITE_NAME } from "@/lib/metadata"

const NAV_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/playbook", label: "Playbook" },
  { href: "/demo", label: "Demo" },
]

export default function BlogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="font-heading text-lg font-black tracking-tight"
            >
              {SITE_NAME}
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <Button size="sm" variant="outline" render={<Link href="/sign-in" />}>
            Sign in
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8 text-sm">
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
          <span>Research-grade portfolio runs, explained.</span>
        </div>
      </footer>
    </div>
  )
}
