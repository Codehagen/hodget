// Only allow same-origin destinations — prevents open-redirect via
// ?redirect=. Prefix checks are not enough: the URL parser strips embedded
// tab/newline/CR, so "/\t/evil.com" normalises to protocol-relative
// "//evil.com". Resolving against a fixed base and comparing origins is the
// only check that survives that normalisation.
export function safeRedirect(value: string | null): string {
  const fallback = "/dashboard"
  if (!value || !value.startsWith("/")) return fallback
  const base = "https://internal.invalid"
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return fallback
  }
  if (url.origin !== base) return fallback
  const result = url.pathname + url.search + url.hash
  // Dot-segment normalisation can turn a same-origin input into a
  // protocol-relative output ("/..//evil.com" → "//evil.com"), so the
  // OUTPUT must survive the same origin check before we trust it.
  try {
    if (new URL(result, base).origin !== base) return fallback
  } catch {
    return fallback
  }
  return result
}
