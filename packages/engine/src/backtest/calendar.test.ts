import { describe, expect, it } from "vitest"

import { createTradingCalendar } from "./calendar.js"

// XNAS open on a day XOSL is closed (an Oslo-only holiday), and vice versa.
const XNAS = ["2020-05-18", "2020-05-19", "2020-05-20", "2020-05-21", "2020-05-22"]
const XOSL = ["2020-05-18", "2020-05-19", "2020-05-20", "2020-05-22"] // 05-21 Oslo holiday

const calendar = createTradingCalendar({ XNAS, XOSL })

describe("TradingCalendar", () => {
  it("unions per-exchange days, sorted and de-duplicated", () => {
    expect(calendar.union).toEqual([
      "2020-05-18",
      "2020-05-19",
      "2020-05-20",
      "2020-05-21",
      "2020-05-22",
    ])
  })

  it("marks a symbol tradable only on its own exchange's days (XOSL holiday, XNAS open)", () => {
    expect(calendar.isTradingDay("XNAS", "2020-05-21")).toBe(true)
    expect(calendar.isTradingDay("XOSL", "2020-05-21")).toBe(false)
  })

  it("returns the next session strictly after a date, per exchange", () => {
    // After the Oslo holiday 05-21, XOSL's next session skips to 05-22.
    expect(calendar.nextSession("XOSL", "2020-05-20")).toBe("2020-05-22")
    expect(calendar.nextSession("XNAS", "2020-05-20")).toBe("2020-05-21")
  })

  it("returns null when no session remains", () => {
    expect(calendar.nextSession("XNAS", "2020-05-22")).toBeNull()
  })

  it("lists trading days within a range", () => {
    expect(calendar.tradingDays("XOSL", { from: "2020-05-19", to: "2020-05-22" })).toEqual([
      "2020-05-19",
      "2020-05-20",
      "2020-05-22",
    ])
  })

  it("treats an exchange absent from the map as never trading", () => {
    expect(calendar.isTradingDay("XNYS", "2020-05-18")).toBe(false)
    expect(calendar.nextSession("XNYS", "2020-05-18")).toBeNull()
  })
})
