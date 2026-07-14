import { describe, expect, it, vi } from "vitest"

// getBlogPosts is the sitemap's only data dependency; mocking it keeps the
// MDX loader out of the test. postDate keeps its real implementation.
vi.mock("@/lib/blog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/blog")>()),
  getBlogPosts: vi.fn(async () => [
    {
      slug: "introducing-hodget",
      metadata: {
        title: "Introducing Hodget",
        summary: "s",
        publishedAt: "2026-07-13",
        author: { name: "Christer Hagen", role: "Founder" },
      },
    },
  ]),
}))

describe("sitemap", () => {
  it("lists the public surfaces and one entry per blog post", async () => {
    const { default: sitemap } = await import("@/app/sitemap")
    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    for (const path of ["/blog", "/blog/introducing-hodget", "/demo", "/playbook"]) {
      expect(urls.some((url) => url.endsWith(path))).toBe(true)
    }
    // No double slashes from HOME_DOMAIN joins.
    expect(urls.every((url) => !url.includes("com//"))).toBe(true)
  })

  it("stamps blog entries with a valid UTC lastModified", async () => {
    const { default: sitemap } = await import("@/app/sitemap")
    const entries = await sitemap()
    const post = entries.find((entry) =>
      entry.url.endsWith("/blog/introducing-hodget")
    )
    expect(post?.lastModified).toEqual(new Date("2026-07-13T00:00:00.000Z"))
  })
})

describe("robots", () => {
  it("disallows the authenticated and machine routes and points at the sitemap", async () => {
    const { default: robots } = await import("@/app/robots")
    const result = robots()
    expect(result.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      // Bare "/dashboard" (no trailing slash) so the index route is covered too.
      disallow: ["/dashboard", "/api/"],
    })
    expect(String(result.sitemap)).toMatch(/^https:\/\/.+\/sitemap\.xml$/)
  })
})
