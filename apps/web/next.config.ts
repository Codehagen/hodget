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
export default withWorkflow(withMDX(nextConfig))
