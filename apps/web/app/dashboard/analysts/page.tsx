import { AnalystsView } from "@/components/dashboard/analysts-view"
import { getSeatEvidence, requireSession, type SeatEvidenceView } from "@/lib/dal"

/**
 * The signed-in analysts surface. The same view the public /demo route renders,
 * plus the seat gate computed from the user's most recent completed run
 * (plan 024).
 *
 * Defensive like RealRunsSection: the engine DB may be unreachable, and one
 * unavailable panel should never take down an otherwise fixture-backed page. A
 * failure degrades to the demo's shape — no panel — rather than an error screen.
 */
export default async function DashboardAnalystsPage() {
  // Outside the try, and that placement is the whole guard. `requireSession`
  // enforces auth by *throwing* `redirect("/sign-in")`, and Next's own docs are
  // explicit that `redirect` must be called outside a `try` block because it
  // signals through a thrown error (`next/dist/docs/.../functions/redirect.md`).
  // Caught, the guard becomes a no-op. It is `cache()`d and the dashboard layout
  // already awaited it, so this costs no extra round-trip.
  await requireSession()

  let seatEvidence: SeatEvidenceView | null = null
  try {
    seatEvidence = await getSeatEvidence()
  } catch (error) {
    // Logged, not swallowed: an unreachable database and a genuine attribution
    // bug both land here and both render as "no completed run". Without this
    // line the second one is invisible.
    console.error("[dashboard/analysts] seat evidence unavailable", error)
  }

  return <AnalystsView seatEvidence={seatEvidence ?? undefined} />
}
