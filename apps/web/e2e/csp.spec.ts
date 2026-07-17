import { expect, test } from "@playwright/test"

/**
 * Locks in plan 021: an enforcing, nonce+hash CSP on the dynamic
 * credential-handling surfaces (/sign-in, /sign-up, /dashboard/**), with
 * report-only retained everywhere else as a canary. See apps/web/proxy.ts
 * and apps/web/next.config.ts for the two layers this asserts on.
 */

test("/sign-in carries an enforcing CSP with a nonce and the theme-script hash", async ({
  request,
}) => {
  const response = await request.get("/sign-in")
  const csp = response.headers()["content-security-policy"]
  expect(csp).toBeTruthy()
  expect(csp).toContain("nonce-")
  expect(csp).toContain("sha256-")
})

test("/ carries only the report-only CSP, no enforcing header", async ({
  request,
}) => {
  const response = await request.get("/")
  const headers = response.headers()
  expect(headers["content-security-policy-report-only"]).toBeTruthy()
  expect(headers["content-security-policy"]).toBeFalsy()
})

test("/sign-in renders clean under the enforcing CSP and the theme script executes", async ({
  page,
}) => {
  const cspConsoleErrors: string[] = []
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy/i.test(message.text())
    ) {
      cspConsoleErrors.push(message.text())
    }
  })

  await page.goto("/sign-in")

  // next-themes' FOUC script (covered by the CSP's sha256 hash, not the
  // nonce — see the THEME_SCRIPT_SHA256 comment in proxy.ts) sets a
  // color-scheme class/attribute on <html> as soon as it executes. If the
  // hash goes stale after a next-themes upgrade, the script gets blocked
  // and this assertion catches it.
  const html = page.locator("html")
  await expect(async () => {
    const className = await html.getAttribute("class")
    const styleAttr = await html.getAttribute("style")
    expect(
      (className && /light|dark/.test(className)) ||
        (styleAttr && /color-scheme/.test(styleAttr))
    ).toBeTruthy()
  }).toPass({ timeout: 5_000 })

  expect(cspConsoleErrors).toEqual([])
})
