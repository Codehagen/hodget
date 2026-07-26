import Link from "next/link"

import { PostCover } from "@/components/blog/post-cover"
import { formatPostDate, getBlogPosts } from "@/lib/blog"
import { constructMetadata } from "@/lib/metadata"

export const metadata = constructMetadata({
  title: "Blog",
  description:
    "Product updates and research notes from Hodget, the AI hedge fund engine.",
  canonicalUrl: "/blog",
})

export default async function BlogIndexPage() {
  const posts = await getBlogPosts()

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="font-heading text-4xl font-black tracking-tight">
          Blog
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Product updates and research notes from the Hodget engine.
        </p>
      </div>
      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col gap-4"
          >
            <PostCover src={post.metadata.image} />
            <div className="flex flex-col gap-2">
              <time
                dateTime={post.metadata.publishedAt}
                className="text-muted-foreground text-sm"
              >
                {formatPostDate(post.metadata.publishedAt)}
              </time>
              <h2 className="font-heading text-xl font-bold tracking-tight group-hover:underline">
                {post.metadata.title}
              </h2>
              <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                {post.metadata.summary}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
