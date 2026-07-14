/**
 * Financial number formatting for the engine surfaces. Pure, deterministic
 * helpers — no locale surprises, no runtime state — so server and client render
 * byte-identical output. Pair every rendered figure with `font-mono tabular-nums`
 * (see the <Figure>/<Delta> components in primitives.tsx).
 */

export type Sign = "positive" | "negative" | "zero"

export function signOf(value: number): Sign {
  if (value > 0) return "positive"
  if (value < 0) return "negative"
  return "zero"
}

/** Tailwind text-color class for a P&L sign. Zero stays muted, never green/red. */
export function pnlToneClass(value: number): string {
  const s = signOf(value)
  return s === "positive"
    ? "text-success"
    : s === "negative"
      ? "text-destructive"
      : "text-muted-foreground"
}

const compactUsd = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
  currency: "USD",
  style: "currency",
})

const plainNumber = new Intl.NumberFormat("en-US")

/** e.g. 10_420_000 → "$10.42M". */
export function formatCurrencyCompact(value: number): string {
  return compactUsd.format(value)
}

/** e.g. 84_200 → "+$84.2K", -8_300 → "-$8.3K". Sign is explicit. */
export function formatSignedCurrencyCompact(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : ""
  return `${sign}${compactUsd.format(Math.abs(value))}`
}

/** e.g. 4.2 → "+4.20%", -4.2 → "-4.20%". `digits` defaults to 2. */
export function formatSignedPercent(value: number, digits = 2): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`
}

/** e.g. 49 → "+49bp", -8 → "-8bp". */
export function formatBps(value: number): string {
  return `${value > 0 ? "+" : ""}${Math.round(value)}bp`
}

/** e.g. 0.53 → "+0.53", -0.14 → "-0.14". `digits` defaults to 2. */
export function formatSignedNumber(value: number, digits = 2): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`
}

/** Grouped integer, e.g. 842_134_512 → "842,134,512". */
export function formatInteger(value: number): string {
  return plainNumber.format(value)
}
