import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// next-themes' FOUC-prevention script (injected by ThemeProvider, mounted in
// the root layout) is the one non-framework inline script this app renders.
// Next's automatic nonce-stamping only covers framework/RSC inline scripts,
// not this one — so it needs an explicit hash source in the enforcing CSP.
// This hash is the sha256 of that script's exact byte content for the
// current next-themes version + ThemeProvider config; it is stable across
// requests/pages (verified: identical across "/", "/blog", "/demo",
// "/sign-in", "/sign-up") but WILL go stale on a next-themes upgrade that
// changes the emitted script bytes. If csp.spec.ts starts failing after such
// an upgrade, recompute it: fetch the rendered <script> content and run
//   python3 -c "import hashlib,base64,sys; print(base64.b64encode(hashlib.sha256(sys.stdin.buffer.read()).digest()).decode())"
// See plans/021-*.md.
const THEME_SCRIPT_SHA256 = "sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk="

// Enforcing CSP for the dynamic (session-reading) surfaces: /dashboard/**,
// /sign-in, /sign-up. These already require dynamic rendering (they read
// the session), so a per-request nonce doesn't cost them anything static
// pages would lose. See plan 021 — static/public routes keep the
// report-only policy in next.config.ts as a canary instead.
function buildEnforcingCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' '${THEME_SCRIPT_SHA256}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}

// Optimistic check only: this reads the cookie's presence, it does not validate
// it. A forged cookie gets past this. Every protected page and route handler
// must still call requireSession() — see lib/session.ts.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = getSessionCookie(request)

    if (!sessionCookie) {
      const signInUrl = new URL("/sign-in", request.url)
      signInUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = buildEnforcingCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)

  return response
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
}
