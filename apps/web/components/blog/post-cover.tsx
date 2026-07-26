import { cn } from "@workspace/ui/lib/utils"

/**
 * Cover image for a blog post, shared by the listing card and the post hero.
 * Post covers are 1200x630 (the OG aspect) and often SVG, which next/image
 * doesn't optimize — hence the plain img. Renders a gradient placeholder when
 * a post has no image. `eager` for the above-the-fold post hero; listing
 * cards lazy-load.
 */
export function PostCover({
  src,
  eager = false,
  className,
}: {
  src?: string
  eager?: boolean
  className?: string
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "from-muted to-background aspect-[1200/630] w-full rounded-xl border bg-gradient-to-br",
          className
        )}
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn(
        "aspect-[1200/630] w-full rounded-xl border object-cover",
        className
      )}
    />
  )
}
