import { WaitlistForm } from "@/app/waitlist/waitlist-form"
import { RevealOnScroll } from "@/components/landing/reveal"

/**
 * Waitlist — the closing conversion block. Reuses the existing WaitlistForm
 * (and its server action) with the "landing" source, so success and inline
 * error states are handled in one place. A narrow centered column sets it apart
 * from the wide, left-aligned sections above.
 */
export function WaitlistSection() {
  return (
    <RevealOnScroll className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Join the waitlist
          </h2>
          <p className="text-lg text-muted-foreground">
            hodget is invite-only while in development.
          </p>
        </div>
        <WaitlistForm source="landing" />
      </div>
    </RevealOnScroll>
  )
}
