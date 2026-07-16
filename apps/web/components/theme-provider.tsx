"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

/**
 * Explicit light/dark flips crossfade instead of hard-cutting: the toggle
 * stamps `data-theme-transition` on <html> for the flip and removes it once
 * the fade is over. globals.css pairs the attribute with a short uniform
 * color transition (higher specificity than the `transition: none` next-themes
 * injects for `disableTransitionOnChange`, so the crossfade wins for explicit
 * toggles while system-initiated theme changes stay guarded). Every toggle
 * surface (sidebar button, "D" hotkey, playbook) goes through this hook.
 */
const THEME_TRANSITION_MS = 250
let transitionTimer: number | undefined

function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return React.useCallback(() => {
    const root = document.documentElement
    root.setAttribute("data-theme-transition", "")
    window.clearTimeout(transitionTimer)
    transitionTimer = window.setTimeout(() => {
      root.removeAttribute("data-theme-transition")
    }, THEME_TRANSITION_MS)
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  const toggleTheme = useThemeToggle()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      toggleTheme()
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [toggleTheme])

  return null
}

export { ThemeProvider, useThemeToggle }
