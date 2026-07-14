"use client"

import * as React from "react"

import type { DecisionMap } from "./data"
import { DecisionFlow } from "./decision-flow"
import { AdvisorRail } from "./inspector"
import { analystNodeId } from "./layout"

/**
 * The interactive canvas + advisor rail as a self-contained client unit — the
 * per-run decision page uses this beside its own header. Selection is owned here
 * so the canvas and the rail stay in sync; the rail tracks whichever advisor
 * node is selected (default: the lead view) and holds that advisor when a
 * non-advisor node is inspected.
 */
export function DecisionCanvas({
  map,
  entrance,
}: {
  map: DecisionMap
  /**
   * Forwarded to {@link DecisionFlow} to gate the one-time entrance stagger.
   * Omit for the default (plays on mount); pass a boolean to defer play (e.g.
   * on-scroll on the landing page).
   */
  entrance?: boolean
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    analystNodeId(map.primaryAnalystId)
  )
  const [railAdvisorId, setRailAdvisorId] = React.useState(map.primaryAnalystId)

  const handleSelectedIdChange = React.useCallback(
    (id: string | null) => {
      setSelectedId(id)
      const advisor = map.analysts.find((a) => analystNodeId(a.analystId) === id)
      if (advisor) setRailAdvisorId(advisor.analystId)
    },
    [map]
  )

  const advisor =
    map.analysts.find((a) => a.analystId === railAdvisorId) ??
    map.analysts.find((a) => a.analystId === map.primaryAnalystId)!

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <DecisionFlow
        map={map}
        selectedId={selectedId}
        onSelectedIdChange={handleSelectedIdChange}
        entrance={entrance}
      />
      <AdvisorRail map={map} advisor={advisor} />
    </div>
  )
}
