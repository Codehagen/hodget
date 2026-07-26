import { describe, expect, it } from "vitest"

import { DataQualityError } from "./errors.js"
import { coerceKnownAt, zonedEndOfDay } from "./time.js"

describe("zonedEndOfDay", () => {
  it("resolves to 23:59:59.999 local (Oslo, winter = UTC+1)", () => {
    // 2020-02-12 23:59:59.999 CET == 2020-02-12 22:59:59.999 UTC
    const ms = zonedEndOfDay("2020-02-12", "Europe/Oslo")
    expect(new Date(ms).toISOString()).toBe("2020-02-12T22:59:59.999Z")
  })

  it("resolves to 23:59:59.999 local (Oslo, summer = UTC+2)", () => {
    const ms = zonedEndOfDay("2020-06-15", "Europe/Oslo")
    expect(new Date(ms).toISOString()).toBe("2020-06-15T21:59:59.999Z")
  })

  it("resolves to 23:59:59.999 local (New York, EDT = UTC-4)", () => {
    const ms = zonedEndOfDay("2020-06-15", "America/New_York")
    expect(new Date(ms).toISOString()).toBe("2020-06-16T03:59:59.999Z")
  })
})

describe("coerceKnownAt", () => {
  it("parses a full instant as-is", () => {
    expect(coerceKnownAt("2020-06-15T20:00:00Z", "Europe/Oslo")).toBe(
      Date.parse("2020-06-15T20:00:00Z"),
    )
  })

  it("coerces a date-only value to exchange end-of-day (visible next day)", () => {
    const closeSameDay = Date.parse("2020-02-12T20:00:00Z")
    const coerced = coerceKnownAt("2020-02-12", "Europe/Oslo")
    // End-of-day is AFTER that day's close, so it is not yet visible.
    expect(coerced).toBeGreaterThan(closeSameDay)
  })

  it("throws DataQualityError on an unusable value", () => {
    expect(() => coerceKnownAt("nonsense", "Europe/Oslo")).toThrow(DataQualityError)
    expect(() => coerceKnownAt("", "Europe/Oslo")).toThrow(DataQualityError)
  })
})
