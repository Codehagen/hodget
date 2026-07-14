import type { MetadataRoute } from "next"

import { getBlogPosts, postDate } from "@/lib/blog"
import { HOME_DOMAIN } from "@/lib/metadata"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getBlogPosts()

  return [
    { url: HOME_DOMAIN, priority: 1 },
    { url: `${HOME_DOMAIN}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...posts.map((post) => ({
      url: `${HOME_DOMAIN}/blog/${post.slug}`,
      lastModified: postDate(post.metadata.publishedAt),
      priority: 0.7,
    })),
    { url: `${HOME_DOMAIN}/demo`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${HOME_DOMAIN}/playbook`, priority: 0.4 },
  ]
}
