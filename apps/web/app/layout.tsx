import { Geist, Geist_Mono, Inter } from "next/font/google"

import { NuqsAdapter } from "nuqs/adapters/next/app"

import "@workspace/ui/globals.css"
import { constructMetadata } from "@/lib/metadata"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils";

// TanStack Query returns with real data fetching (plan 003) — its provider
// was removed as dead scaffolding until then (plan 015).

export const metadata = constructMetadata()

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable,
        geist.variable
      )}
    >
      <body>
        <NuqsAdapter>
          <ThemeProvider>{children}</ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
