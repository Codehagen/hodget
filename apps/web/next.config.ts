import { resolve } from "node:path"

import createMDX from "@next/mdx"
import remarkGfm from "remark-gfm"
import type { NextConfig } from "next"
import { withWorkflow } from "workflow/next"

const nextConfig: NextConfig = {
  // mdx must be listed even though no route is a page.mdx: Next only applies the
  // RSC react aliases + flight loader to files matching pageExtensions, so without
  // it imported .mdx modules bind the raw npm react and crash at render.
  pageExtensions: ["ts", "tsx", "mdx"],
  // Workspace packages ship raw TypeScript; Next must transpile them. @workspace/db
  // pulls in @workspace/engine, so both are listed.
  transpilePackages: ["@workspace/ui", "@workspace/db", "@workspace/engine"],
  // The app lives at apps/web; point Next's file-tracing root at the repo root so
  // the Workflow compiler resolves the sibling workspace packages that steps import
  // (@workspace/db, @workspace/engine). See the withWorkflow monorepo guidance.
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  experimental: {
    // @workspace/db and @workspace/engine use NodeNext `.js` import specifiers that
    // actually point at `.ts` sources. This maps them so the bundler resolves them.
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
  },
  // Response hardening (plan 009). CSP ships report-only until it has proven
  // clean against the real bundle in production; the rest are enforcing.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ]
  },
}

// withMDX installs the @mdx-js/loader so posts under content/blog/ can be
// imported as React components (see lib/blog.ts). remark-gfm enables GitHub
// Markdown extensions (tables, strikethrough, autolinks) in posts.
const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
  },
})

// withWorkflow installs the webpack/turbopack loaders that transform the
// "use workflow" / "use step" directives under workflows/. Kept as the outermost
// wrapper so it sees the fully resolved config (transpilePackages + extensionAlias).
//
// Bundler pinned to webpack (--webpack in the dev/build scripts): as of
// Next 16.2, `next build` under Turbopack fails on the MDX loader —
// "@next/mdx/mdx-js-loader.js … does not have serializable options" (the
// remarkPlugins function reference above). Re-probe with `npx next build`
// on @next/mdx / Next upgrades and drop the pin when it passes (plan 015).
export default withWorkflow(withMDX(nextConfig))
