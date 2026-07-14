import { describe, expect, it } from "vitest"

import { constructMetadata, HOME_DOMAIN, SITE_NAME } from "@/lib/metadata"

describe("constructMetadata", () => {
  it("emits the title template on the no-arg root call", () => {
    const meta = constructMetadata()
    expect(meta.title).toEqual({
      default: expect.stringContaining(SITE_NAME),
      template: `%s | ${SITE_NAME}`,
    })
  })

  it("passes page titles through as plain strings for the template", () => {
    expect(constructMetadata({ title: "Blog" }).title).toBe("Blog")
  })

  it("uses an absolute title when fullTitle is passed", () => {
    expect(constructMetadata({ fullTitle: "Standalone" }).title).toEqual({
      absolute: "Standalone",
    })
  })

  it("resolves metadataBase from HOME_DOMAIN with no trailing slash", () => {
    const meta = constructMetadata()
    expect(HOME_DOMAIN.endsWith("/")).toBe(false)
    expect(meta.metadataBase).toEqual(new URL(HOME_DOMAIN))
  })

  it("adds robots noindex/nofollow only when noIndex is set", () => {
    expect(constructMetadata({ noIndex: true }).robots).toEqual({
      index: false,
      follow: false,
    })
    expect(constructMetadata().robots).toBeUndefined()
  })

  it("defaults og:type to website", () => {
    expect(constructMetadata().openGraph).toMatchObject({ type: "website" })
  })

  it("switches og:type to article with publishedTime and authors", () => {
    const meta = constructMetadata({
      article: {
        publishedTime: "2026-07-13T00:00:00.000Z",
        authors: ["Christer Hagen"],
      },
    })
    expect(meta.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-07-13T00:00:00.000Z",
      authors: ["Christer Hagen"],
    })
  })

  it("emits og images with alt text derived from the title", () => {
    const meta = constructMetadata({ title: "Blog", image: "/x.png" })
    expect(meta.openGraph?.images).toEqual([{ url: "/x.png", alt: "Blog" }])
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/x.png"],
    })
  })

  it("suppresses images entirely when image is null", () => {
    const meta = constructMetadata({ image: null })
    expect(meta.openGraph).not.toHaveProperty("images")
    expect(meta.twitter).not.toHaveProperty("images")
    expect(meta.twitter).not.toHaveProperty("card")
  })

  it("feeds canonicalUrl into both the canonical alternate and og:url", () => {
    const meta = constructMetadata({ canonicalUrl: "/blog" })
    expect(meta.alternates?.canonical).toBe("/blog")
    expect(meta.openGraph).toMatchObject({ url: "/blog" })
  })

  it("prefers url over canonicalUrl when both are given", () => {
    const meta = constructMetadata({ url: "/a", canonicalUrl: "/b" })
    expect(meta.alternates?.canonical).toBe("/a")
    expect(meta.openGraph).toMatchObject({ url: "/a" })
  })

  it("omits alternates when neither url nor canonicalUrl is given", () => {
    expect(constructMetadata().alternates).toBeUndefined()
  })
})
