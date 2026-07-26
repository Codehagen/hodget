import { initBotId } from "botid/client/core"

/**
 * Client-side half of Vercel BotID (plan 022). The server action calls
 * `checkBotId()`; this tells the client which paths to attach proof to.
 *
 * The path is the page the action is invoked from, not an API route — server
 * actions POST back to the page they were rendered on. `/waitlist` is the only
 * unauthenticated write in the app, so it is the only path listed.
 */
initBotId({
  protect: [{ path: "/waitlist", method: "POST" }],
})
