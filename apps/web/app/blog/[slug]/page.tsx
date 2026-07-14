import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PostCover } from "@/components/blog/post-cover"
import { formatPostDate, getBlogPost, getBlogPosts, postDate } from "@/lib/blog"
import { constructMetadata } from "@/lib/metadata"

// Posts are compiled into the bundle; only slugs from generateStaticParams exist.
export const dynamicParams = false

export async function generateStaticParams() {
  const posts = await getBlogPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug)
  if (!post) return {}
  return constructMetadata({
    title: post.metadata.title,
    description: post.metadata.summary,
    // Social crawlers do not render SVG; posts provide a raster ogImage.
    image: post.metadata.ogImage ?? post.metadata.image,
    canonicalUrl: `/blog/${slug}`,
    article: {
      publishedTime: postDate(post.metadata.publishedAt).toISOString(),
      authors: [post.metadata.author.name],
    },
  })
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getBlogPost(slug)
  if (!post) notFound()

  const { metadata, Content } = post

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="flex flex-col gap-6">
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <Link href="/blog" className="hover:text-foreground transition-colors">
            Blog
          </Link>
          <span aria-hidden>/</span>
          <time dateTime={metadata.publishedAt}>
            {formatPostDate(metadata.publishedAt)}
          </time>
        </div>
        <h1 className="font-heading text-4xl font-black tracking-tight text-balance sm:text-5xl">
          {metadata.title}
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          {metadata.summary}
        </p>
        <div className="flex items-center gap-3">
          <div className="bg-muted font-heading flex size-9 items-center justify-center rounded-full border text-sm font-bold">
            {metadata.author.name.charAt(0)}
          </div>
          <div className="text-sm">
            <div className="font-medium">{metadata.author.name}</div>
            <div className="text-muted-foreground">{metadata.author.role}</div>
          </div>
        </div>
      </header>
      {metadata.image ? (
        <PostCover src={metadata.image} eager className="mt-10" />
      ) : null}
      <div className="typeset typeset-docs mx-auto mt-12 max-w-[37em]">
        <Content />
      </div>
    </article>
  )
}
