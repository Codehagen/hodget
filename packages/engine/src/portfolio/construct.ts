import type { Currency } from "../data/types.js"
import type { TargetView, TargetWeight } from "../types.js"

/**
 * Construction — stage (a) of the portfolio pipeline (plan 002 phase 4).
 *
 * Turns committee {@link TargetView}s into desired long-only book weights,
 * **conviction-proportional with hard caps**:
 *
 * - A view's weight is `clamp(conviction, 0, 1) × maxWeightPerName`. Magnitude
 *   scales exposure — a 0.9 view targets 9× a 0.1 view under equal caps.
 * - **Long-only for now** (the book models no shorts): a non-positive conviction
 *   targets weight 0, so a neutral/bearish view sells the name to flat downstream
 *   rather than opening a short.
 * - No single name exceeds `maxWeightPerName`; if the book's gross target exceeds
 *   `maxGross`, every weight is scaled down proportionally (a soft, pre-sizing
 *   cap — the risk stage enforces the *hard* gross limit after sizing).
 * - A view whose security has no current mark price is dropped (it cannot be
 *   sized), never guessed.
 *
 * This stage is pure over its inputs and independently testable. Sizing (stage b)
 * and risk gates (stage c) consume its output; nothing here touches the book's
 * share counts — it only expresses intent as weights.
 */

export interface ConstructionConfig {
  /** Max fraction of equity targeted for any one name. Default 0.2. */
  readonly maxWeightPerName?: number
  /** Max summed target weight before proportional scaling. Default 1. */
  readonly maxGross?: number
}

export interface ConstructionContext {
  /** The trading currency of a security. */
  currencyOf(securityId: string): Currency
  /** Whether a current mark price exists (a name with none cannot be sized). */
  hasMark(securityId: string): boolean
}

type ResolvedConstruction = Required<ConstructionConfig>

function resolve(config: ConstructionConfig): ResolvedConstruction {
  return {
    maxWeightPerName: config.maxWeightPerName ?? 0.2,
    maxGross: config.maxGross ?? 1,
  }
}

export function construct(
  views: readonly TargetView[],
  ctx: ConstructionContext,
  config: ConstructionConfig = {},
): TargetWeight[] {
  const { maxWeightPerName, maxGross } = resolve(config)

  const raw: TargetWeight[] = []
  for (const view of views) {
    if (!ctx.hasMark(view.securityId)) continue
    const weight = Math.max(0, Math.min(1, view.conviction)) * maxWeightPerName
    raw.push({ securityId: view.securityId, currency: ctx.currencyOf(view.securityId), weight })
  }

  const gross = raw.reduce((sum, w) => sum + w.weight, 0)
  const scale = gross > maxGross && gross > 0 ? maxGross / gross : 1

  return raw
    .map((w) => ({ ...w, weight: w.weight * scale }))
    .sort((a, b) => (a.securityId < b.securityId ? -1 : a.securityId > b.securityId ? 1 : 0))
}
