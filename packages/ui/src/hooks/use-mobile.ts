import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * True on viewports below the mobile breakpoint. Uses useSyncExternalStore so
 * there's no setState-in-effect and it stays SSR-safe (server snapshot = false).
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false
  )
}
