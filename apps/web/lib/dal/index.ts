import "server-only"

import { requireSession } from "@/lib/session"

/**
 * The Data Access Layer — the app's ONLY authorization boundary.
 *
 * Every export in this module must call requireSession() before touching data,
 * and this is the only module allowed to import @workspace/db. ESLint enforces
 * both halves of that rule; proxy.ts is NOT a security boundary.
 *
 * Real data-access functions go here — each one starting with
 * `await requireSession()` and scoping its query to the session user, e.g.:
 *
 *   export async function getPositions() {
 *     const session = await requireSession()
 *     return listPositionsByOwner(getDb(), session.user.id)
 *   }
 *
 * Do not invent a schema — add functions here as tables land.
 *
 * The one deliberate exception is lib/dal/waitlist.ts: signups happen before an
 * account exists, so it has no session to validate. It is NOT re-exported here,
 * precisely so this module's contract stays absolute.
 */

// Re-exported so callers reach the session boundary through the DAL.
export { requireSession }

/** The session user's id — the narrowest possible read through the boundary. */
export async function getSessionUserId() {
  const session = await requireSession()
  return session.user.id
}

// Engine persistence surface — the ONLY place @workspace/db is reached, always
// after requireSession(). Route handlers import from here, never from the package.
export { createRun, listRuns, getRunDetail, getOwnedRun, type RunDetail } from "./runs"
export { listPanelConfigs, createPanelConfig } from "./panel-configs"
export {
  getSeatEvidence,
  type SeatAnalystView,
  type SeatEvidenceView,
  type SeatReasonView,
} from "./analysts"
export { runRegistry, startRun } from "./run-registry"

// Validation schemas + event helpers re-exported so route handlers can validate
// bodies and read the SSE event shape without importing @workspace/db directly.
export {
  runConfigSchema,
  panelSchema,
  panelConfigInputSchema,
  isTerminal,
  type RunConfig,
  type RunEvent,
  type Panel,
  type PanelConfig,
  type EngineRun,
} from "@workspace/db"
