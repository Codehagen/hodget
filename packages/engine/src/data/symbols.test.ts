import { describe, expect, it } from "vitest"

import { createSecurityResolver, micTimeZone } from "./symbols.js"

describe("security resolver", () => {
  const resolver = createSecurityResolver([
    { securityId: "US-XNAS-SYNA", symbol: "SYNA", mic: "XNAS" },
    { securityId: "NO-XOSL-OSYN", symbol: "OSYN", mic: "XOSL" },
  ])

  it("resolves a registered securityId to its { symbol, mic }", () => {
    expect(resolver.resolve("US-XNAS-SYNA")).toEqual({ symbol: "SYNA", mic: "XNAS" })
    expect(resolver.resolve("NO-XOSL-OSYN")).toEqual({ symbol: "OSYN", mic: "XOSL" })
  })

  it("returns null for an unknown, non-encoded id", () => {
    expect(resolver.resolve("XX-XXXX-NONE")).toBeNull()
  })

  it("round-trips a { symbol, mic } through the encoded fallback form", () => {
    const id = resolver.idFor({ symbol: "EQNR", mic: "XOSL" })
    expect(id).toBe("XOSL:EQNR")
    expect(resolver.resolve(id)).toEqual({ symbol: "EQNR", mic: "XOSL" })
  })
})

describe("exchange timezones", () => {
  it("maps MICs to IANA timezones", () => {
    expect(micTimeZone("XNAS")).toBe("America/New_York")
    expect(micTimeZone("XNYS")).toBe("America/New_York")
    expect(micTimeZone("XOSL")).toBe("Europe/Oslo")
  })
})
