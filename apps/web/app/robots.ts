import type { MetadataRoute } from "next"

import { HOME_DOMAIN } from "@/lib/metadata"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /dashboard is authenticated (also noIndex); /api is machine-only.
      // No trailing slash: "/dashboard/" would not match the bare /dashboard.
      disallow: ["/dashboard", "/api/"],
    },
    sitemap: `${HOME_DOMAIN}/sitemap.xml`,
  }
}
