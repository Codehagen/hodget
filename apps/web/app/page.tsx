import { getBlogPosts } from "@/lib/blog"
import { constructMetadata } from "@/lib/metadata"
import { LandingNav } from "@/components/landing/landing-nav"
import { Hero } from "@/components/landing/hero"
import { EvidenceStrip } from "@/components/landing/evidence-strip"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Proof } from "@/components/landing/proof"
import { OpenSource } from "@/components/landing/open-source"
import { Honesty } from "@/components/landing/honesty"
import { Writing } from "@/components/landing/writing"
import { WaitlistSection } from "@/components/landing/waitlist-section"
import { LandingFooter } from "@/components/landing/landing-footer"

export const metadata = constructMetadata({
  description:
    "hodget is an open-source AI hedge fund engine. AI advisors form views, deterministic code sizes and limits every position, and every decision is recorded and can be explained.",
  canonicalUrl: "/",
})

export default async function Page() {
  const posts = await getBlogPosts()

  return (
    <div className="flex min-h-svh flex-col">
      <LandingNav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <EvidenceStrip />
        <HowItWorks />
        <Proof />
        <OpenSource />
        <Honesty />
        <Writing posts={posts} />
        <WaitlistSection />
      </main>
      <LandingFooter />
    </div>
  )
}
