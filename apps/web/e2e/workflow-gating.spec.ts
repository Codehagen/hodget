import { expect, test } from "@playwright/test"

/**
 * Plan 019: regression-detection for the workflow-endpoint trust assumption.
 *
 * `lib/dal/run-workflow.ts` documents that the generated
 * `/.well-known/workflow/v1/step` and `/flow` routes invoke step bodies without
 * an app-level session check, trusting Vercel's platform-level gating instead.
 * That gate is verified, not assumed: the Workflow SDK's Next.js build step
 * (`@workflow/next`'s `writeFunctionsConfig`) writes
 * `.well-known/workflow/v1/config.json` with `experimentalTriggers` that register
 * `step` and `flow` as Vercel Queue consumers — see
 * `docs/deploying/world/vercel-world.mdx` "Security" and
 * `docs/how-it-works/framework-integrations.mdx` "Security" in the installed
 * `workflow@4.6.0` package.
 *
 * That queue-consumer registration has a *local*, directly observable effect:
 * `next build` does not emit `step`/`flow` into the standard Next.js app route
 * table at all (`.next/server/app/` has no `.well-known` entry), so an
 * unauthenticated HTTP call against a production build gets the same 404 as any
 * nonexistent path — there is no distinguishable "workflow endpoint" to attack
 * locally, and on Vercel the same routes are deployed as queue-only functions
 * that public HTTP can't reach at all.
 *
 * This probe's purpose is regression detection: if a future change to
 * `next.config.ts`, the `workflow`/`@workflow/next` dependency, or the build
 * pipeline ever causes these routes to become directly reachable again, the
 * status code observed here stops being 404 and this test fails.
 *
 * The `/.well-known/workflow/v1/webhook/[token]` route is NOT covered here:
 * `createWebhook()` is documented as an intentionally public endpoint gated only
 * by its token, and this codebase never calls `createWebhook()` (see the
 * `run-workflow.ts` auth-model comment), so it is unused surface, not part of
 * this trust model.
 */

test("the workflow step endpoint refuses external calls (unreachable, same as a 404)", async ({
  request,
}) => {
  const response = await request.post("/.well-known/workflow/v1/step", {
    data: { foo: "bar" },
  })
  expect(response.status()).toBe(404)
})

test("the workflow flow endpoint refuses external calls (unreachable, same as a 404)", async ({
  request,
}) => {
  const response = await request.post("/.well-known/workflow/v1/flow", {
    data: { foo: "bar" },
  })
  expect(response.status()).toBe(404)
})
