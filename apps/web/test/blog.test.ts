import { describe, expect, it } from "vitest"

import { formatPostDate, getBlogPost, postDate } from "@/lib/blog"

describe("getBlogPost slug guard", () => {
  // Malformed slugs must be rejected BEFORE reaching the dynamic import path —
  // the guard is what keeps arbitrary strings out of the webpack context.
  it.each(["../secrets", "Foo", "a.b", "a_b", "", "a/b", "a b"])(
    "rejects %j",
    async (slug) => {
      await expect(getBlogPost(slug)).resolves.toBeNull()
    }
  )

  it("returns null for a well-formed but nonexistent slug", async () => {
    await expect(getBlogPost("no-such-post")).resolves.toBeNull()
  })
})

describe("postDate", () => {
  it("anchors a date-only string at UTC midnight", () => {
    expect(postDate("2026-07-13").toISOString()).toBe(
      "2026-07-13T00:00:00.000Z"
    )
  })
})

describe("formatPostDate", () => {
  it("formats an ISO date in en-US long form", () => {
    expect(formatPostDate("2026-07-13")).toBe("July 13, 2026")
  })

  it("pins to UTC across day boundaries regardless of local timezone", () => {
    expect(formatPostDate("2025-12-31")).toBe("December 31, 2025")
    expect(formatPostDate("2026-01-01")).toBe("January 1, 2026")
  })
})
