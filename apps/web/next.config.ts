import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next must transpile them. @workspace/db
  // pulls in @workspace/engine, so both are listed.
  transpilePackages: ["@workspace/ui", "@workspace/db", "@workspace/engine"],
  experimental: {
    // @workspace/db and @workspace/engine use NodeNext `.js` import specifiers that
    // actually point at `.ts` sources. This maps them so the bundler resolves them.
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
  },
}

export default nextConfig
