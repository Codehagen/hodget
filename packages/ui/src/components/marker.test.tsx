import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Marker, MarkerContent, markerVariants } from "./marker.js"

/**
 * First test in the shared UI package (plan 012): marker carries real logic
 * (cva variants + useRender polymorphism), unlike the pure-markup re-exports.
 */

describe("Marker", () => {
  it("renders the default variant with its slot and content", () => {
    const { container, getByText } = render(
      <Marker>
        <MarkerContent>Run queued</MarkerContent>
      </Marker>
    )
    const root = container.querySelector('[data-slot="marker"]')
    expect(root).toBeTruthy()
    expect(getByText("Run queued")).toBeTruthy()
    // Default variant has no separator hairlines.
    expect(root!.className).not.toContain("before:")
  })

  it("renders the separator variant with hairline pseudo classes", () => {
    const { container } = render(
      <Marker variant="separator">
        <MarkerContent>2026-07-09</MarkerContent>
      </Marker>
    )
    const root = container.querySelector('[data-slot="marker"]')
    expect(root!.className).toContain("before:")
    expect(root!.className).toContain("after:")
  })

  it("supports render polymorphism (renders as the provided element)", () => {
    const { container } = render(
      <Marker render={<section aria-label="events" />}>
        <MarkerContent>text</MarkerContent>
      </Marker>
    )
    expect(container.querySelector('section[data-slot="marker"]')).toBeTruthy()
  })

  it("exposes variants through markerVariants for consumers", () => {
    expect(markerVariants({ variant: "border" })).toContain("border-b")
  })
})
