import "server-only"

import { createClient } from "@/lib/supabase/server"
import { requireSession } from "@/lib/session"

/**
 * The Data Access Layer — the app's ONLY authorization boundary.
 *
 * Every export in this module must call requireSession() before touching data,
 * and this is the only module allowed to import the Supabase server client
 * (@/lib/supabase/server). ESLint enforces both halves of that rule; proxy.ts is
 * NOT a security boundary.
 *
 * The Supabase schema is still empty (see lib/supabase/types.ts), so there are no
 * real queries yet. Real data-access functions go here — each one starting with
 * `await requireSession()` and scoping its query to the session user, e.g.:
 *
 *   export async function getPositions() {
 *     const session = await requireSession()
 *     const supabase = await createClient()
 *     const { data, error } = await supabase
 *       .from("positions")
 *       .select("*")
 *       .eq("user_id", session.user.id)
 *     if (error) throw error
 *     return data
 *   }
 *
 * Do not invent a schema — add functions here as tables land.
 */

// Re-exported so callers reach the session boundary through the DAL.
export { requireSession }

/**
 * Placeholder proving the Supabase boundary wiring is live: it validates the
 * session and constructs the (only-permitted-here) Supabase server client. The
 * engine tables live in Postgres via @workspace/db (see runs.ts / panel-configs.ts);
 * this stays until Supabase-backed user data (positions, etc.) lands.
 */
export async function getSessionUserId() {
  const session = await requireSession()
  // Ensures the restricted Supabase import is exercised from inside the DAL.
  void createClient
  return session.user.id
}

// Engine persistence surface — the ONLY place @workspace/db is reached, always
// after requireSession(). Route handlers import from here, never from the package.
export { createRun, listRuns, getRunDetail, getOwnedRun, type RunDetail } from "./runs"
export { listPanelConfigs, createPanelConfig } from "./panel-configs"
export { runRegistry } from "./run-registry"

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
