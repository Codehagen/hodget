import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { constructMetadata } from "@/lib/metadata"

import { WaitlistForm } from "./waitlist-form"

export const metadata = constructMetadata({
  title: "Join the waitlist",
  description:
    "Hodget is invite-only while in development. Join the waitlist to get early access to the AI hedge fund engine.",
  canonicalUrl: "/waitlist",
})

// Known entry points; anything else falls back to "landing". The server action
// re-validates, so this is only about not echoing a junk value into the form.
const SOURCES = new Set(["landing", "demo-sidebar"])

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>
}) {
  const { source } = await searchParams
  const resolvedSource = source && SOURCES.has(source) ? source : "landing"

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm motion-safe:animate-fade-in">
        <CardHeader>
          <CardTitle className="text-base">Join the waitlist</CardTitle>
          <CardDescription>
            Hodget is invite-only while in development. Leave your email and
            we&apos;ll reach out when a spot opens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WaitlistForm source={resolvedSource} />
        </CardContent>
      </Card>
    </main>
  )
}
