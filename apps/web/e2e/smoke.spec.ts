import { expect, test } from "@playwright/test"

/**
 * Public-surface smoke (plan 013): the journeys a prospective user actually
 * takes, against the real production build. The streaming assertions get
 * generous timeouts — the simulated run replay takes ~8s by design and is
 * deterministic, so a flake here means a selector broke, not timing.
 */

test("landing links into the demo", async ({ page }) => {
  await page.goto("/")
  // base-ui Button-rendered links expose role "button", so target the anchor
  // by href + text instead of the link role.
  const demoCta = page
    .locator('a[href="/demo"]', { hasText: /explore the live demo/i })
    .first()
  await expect(demoCta).toBeVisible()
  await demoCta.click()
  await expect(page).toHaveURL(/\/demo$/)
  await expect(page.getByText("Demo — mock data")).toBeVisible()
})

test("the simulated run replays to completion and links to the run detail", async ({
  page,
}) => {
  await page.goto("/demo")
  await page.getByRole("button", { name: "New run" }).click()
  await page.getByRole("button", { name: "Start run" }).click()

  await expect(page.getByText(/Run completed/)).toBeVisible({
    timeout: 20_000,
  })
  const fullRun = page.locator('a[href="/demo/runs/run_8c41ca"]', {
    hasText: /view full run/i,
  })
  await expect(fullRun).toBeVisible()
  await fullRun.click()
  await expect(page).toHaveURL(/\/demo\/runs\/run_8c41ca$/)
})

test("Ask Hodget streams the first scripted exchange", async ({ page }) => {
  await page.goto("/demo/ask")
  await page.getByRole("button", { name: "Send" }).click()

  await expect(page.getByText(/earnings-drift analyst/).first()).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByRole("textbox", { name: /next scripted question/i })
  ).toHaveValue("What did the value analyst think?", { timeout: 20_000 })
})

test("unauthenticated /dashboard redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/sign-in/)
})
