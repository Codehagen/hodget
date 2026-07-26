import type { Metadata } from "next"

// Trailing slash stripped so `${HOME_DOMAIN}/sitemap.xml`-style joins never
// produce double slashes when the env override ends with "/".
export const HOME_DOMAIN = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://hodget.com"
).replace(/\/$/, "")

export const SITE_NAME = "Hodget"

const DEFAULT_TITLE = "Hodget - The AI Hedge Fund Engine"

const DEFAULT_DESCRIPTION =
  "Hodget is an AI hedge fund engine: a committee of AI analysts that debates every position, a risk gate that can veto them, and a run log you can read end to end."

/**
 * Builds the Metadata object for a page.
 *
 * - The no-arg root-layout call emits a title template ("%s | Hodget"), so
 *   pages pass a plain `title` and Next composes the suffix — don't suffix
 *   manually. `fullTitle` opts out of the template via `title.absolute`.
 * - Relative image/canonical paths resolve against metadataBase (HOME_DOMAIN).
 * - Social images must be raster (png/jpg) — OG crawlers do not render SVG.
 * - Pass `article` on blog posts for og:type=article + published_time/author.
 */
export function constructMetadata({
  title,
  fullTitle,
  description = DEFAULT_DESCRIPTION,
  image = "/thumbnail.png",
  video,
  icons,
  url,
  canonicalUrl,
  noIndex = false,
  manifest,
  article,
}: {
  title?: string
  fullTitle?: string
  description?: string
  image?: string | null
  video?: string | null
  icons?: Metadata["icons"]
  url?: string
  canonicalUrl?: string
  noIndex?: boolean
  manifest?: string | URL | null
  article?: { publishedTime: string; authors: string[] }
} = {}): Metadata {
  return {
    title: fullTitle
      ? { absolute: fullTitle }
      : (title ?? { default: DEFAULT_TITLE, template: `%s | ${SITE_NAME}` }),
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      ...(article
        ? {
            type: "article",
            publishedTime: article.publishedTime,
            authors: article.authors,
          }
        : { type: "website" }),
      ...(image && {
        images: [
          { url: image, alt: fullTitle || title || DEFAULT_TITLE },
        ],
      }),
      // og:url should match the canonical, so canonicalUrl feeds both.
      url: url || canonicalUrl,
      ...(video && {
        videos: video,
      }),
    },
    twitter: {
      title,
      description,
      ...(image && {
        card: "summary_large_image",
        images: [image],
      }),
      ...(video && {
        player: video,
      }),
      creator: "@codehagen",
    },
    ...(icons && { icons }),
    metadataBase: new URL(HOME_DOMAIN),
    ...((url || canonicalUrl) && {
      alternates: {
        canonical: url || canonicalUrl,
      },
    }),
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
    ...(manifest && {
      manifest,
    }),
  }
}
