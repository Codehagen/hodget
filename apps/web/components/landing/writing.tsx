import Link from "next/link"

import { formatPostDate, type Post } from "@/lib/blog"
import { RevealOnScroll } from "@/components/landing/reveal"

// Post metadata is authored elsewhere (content/blog/*.mdx) and may use em/en
// dashes. The landing page holds a strict no-dash rule for every visible
// string, so titles and summaries are normalized to commas here at the render
// boundary without touching the source posts.
function plainDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ")
}

/**
 * Writing — an editorial list of the published posts (title, description, date),
 * divided by hairlines. Each row links to the post; a single "All writing" link
 * heads to the blog index.
 */
export function Writing({ posts }: { posts: Post[] }) {
  return (
    <RevealOnScroll className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Writing
        </h2>
        <Link
          href="/blog"
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          All writing
        </Link>
      </div>

      <ul className="mt-10 border-t border-foreground/10">
        {posts.map((post) => (
          <li
            key={post.slug}
            className="flex flex-col gap-3 border-b border-foreground/10 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10"
          >
            <div className="flex flex-col gap-1.5">
              <Link
                href={`/blog/${post.slug}`}
                className="font-heading text-lg font-bold tracking-tight text-foreground underline-offset-4 hover:underline"
              >
                {plainDashes(post.metadata.title)}
              </Link>
              <p className="max-w-2xl text-muted-foreground">
                {plainDashes(post.metadata.summary)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-5 sm:flex-col sm:items-end sm:gap-1.5">
              <time
                dateTime={post.metadata.publishedAt}
                className="font-mono text-xs text-muted-foreground tabular-nums"
              >
                {formatPostDate(post.metadata.publishedAt)}
              </time>
              <Link
                href={`/blog/${post.slug}`}
                className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                Read
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </RevealOnScroll>
  )
}
