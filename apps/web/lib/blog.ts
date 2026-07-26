import "server-only"

import { readdir } from "node:fs/promises"
import path from "node:path"
import type { ComponentType } from "react"

export interface PostMetadata {
  title: string
  summary: string
  publishedAt: string
  author: { name: string; role: string }
  /** Path under public/, shown as the hero and on the listing card. */
  image?: string
  /** Raster (png/jpg) variant for social cards — OG crawlers don't render SVG. */
  ogImage?: string
}

export interface Post {
  slug: string
  metadata: PostMetadata
}

interface PostModule {
  default: ComponentType
  metadata?: PostMetadata
}

const POSTS_DIR = path.join(process.cwd(), "content/blog")

/**
 * Imports a post module by slug. The template-literal import keeps webpack's
 * context scoped to content/blog so every post is bundled and loadable by
 * slug at build time (all blog routes are statically generated).
 */
async function importPost(slug: string): Promise<PostModule> {
  return (await import(`@/content/blog/${slug}.mdx`)) as PostModule
}

export async function getBlogPosts(): Promise<Post[]> {
  const entries = await readdir(POSTS_DIR)
  const posts = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".mdx"))
      .map(async (entry) => {
        const slug = entry.replace(/\.mdx$/, "")
        const { metadata } = await importPost(slug)
        if (!metadata) {
          throw new Error(`content/blog/${entry} is missing a metadata export`)
        }
        return { slug, metadata }
      })
  )
  return posts.sort((a, b) =>
    b.metadata.publishedAt.localeCompare(a.metadata.publishedAt)
  )
}

export async function getBlogPost(
  slug: string
): Promise<(Post & { Content: ComponentType }) | null> {
  // Reject anything that isn't a plain slug before it reaches the import path.
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  try {
    const { default: Content, metadata } = await importPost(slug)
    if (!metadata) return null
    return { slug, metadata, Content }
  } catch {
    return null
  }
}

/**
 * Anchors a date-only `publishedAt` string ("2026-07-13") at UTC midnight.
 * Single source for the convention — used by the rendered date, the sitemap
 * lastModified, and og article:published_time.
 */
export function postDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

export function formatPostDate(date: string): string {
  return postDate(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}
