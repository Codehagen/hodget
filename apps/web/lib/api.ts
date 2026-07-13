import "server-only"

/**
 * Small JSON response helpers for the route handlers. Presentation only — no data
 * access lives here.
 */

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 })
}

export function notFound(): Response {
  return Response.json({ error: "not found" }, { status: 404 })
}

export function unprocessable(message: string, issues?: unknown): Response {
  return Response.json({ error: message, issues }, { status: 422 })
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 })
}
