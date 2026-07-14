/**
 * Deterministic column layout for the decision map.
 *
 * Node positions are a pure function of the decision's stage index (the x
 * column) and the node's index within that stage (the y row) — no ELK/dagre
 * auto-layout dependency. Because the pipeline shape is fixed and known (data →
 * views → committee → construction + risk → execution), a fixed column layout
 * stays legible and always draws the same picture for the same decision.
 */

import { MarkerType, type Edge, type Node } from "@xyflow/react"

import type { DecisionMap } from "./data"

/** Horizontal stride between stage columns (px, pre-fitView). */
const STRIDE = 340

const X = {
  data: 0 * STRIDE,
  analyst: 1 * STRIDE,
  committee: 2 * STRIDE,
  constrisk: 3 * STRIDE,
  execution: 4 * STRIDE,
}

/** Five numbered stage columns, rendered as headers above the canvas. */
export const STAGES = [
  { index: 1, label: "Point-in-time data", x: X.data },
  { index: 2, label: "Independent views", x: X.analyst },
  { index: 3, label: "Committee", x: X.committee },
  { index: 4, label: "Construction + risk", x: X.constrisk },
  { index: 5, label: "Execution", x: X.execution },
] as const

export const analystNodeId = (analystId: string) => `analyst:${analystId}`

const ANALYST_ROW_H = 210

export function buildNodes(map: DecisionMap): Node[] {
  const nodes: Node[] = []

  nodes.push({
    id: "data",
    type: "dataSource",
    position: { x: X.data, y: ANALYST_ROW_H },
    data: { d: map.data },
    selectable: true,
    draggable: false,
  })

  map.analysts.forEach((a, i) => {
    nodes.push({
      id: analystNodeId(a.analystId),
      type: "analyst",
      position: { x: X.analyst, y: i * ANALYST_ROW_H },
      data: { a },
      selected: a.analystId === map.primaryAnalystId,
      selectable: true,
      draggable: false,
    })
  })

  nodes.push({
    id: "committee",
    type: "committee",
    position: { x: X.committee, y: ANALYST_ROW_H - 90 },
    data: { c: map.committee },
    selectable: true,
    draggable: false,
  })

  if (map.construction) {
    nodes.push({
      id: "construction",
      type: "construction",
      position: { x: X.constrisk, y: 0 },
      data: { c: map.construction },
      selectable: true,
      draggable: false,
    })
  }

  nodes.push({
    id: "risk",
    type: "risk",
    position: { x: X.constrisk, y: map.construction ? ANALYST_ROW_H + 20 : ANALYST_ROW_H - 40 },
    data: { r: map.risk },
    selectable: true,
    draggable: false,
  })

  if (map.execution) {
    nodes.push({
      id: "execution",
      type: "execution",
      position: { x: X.execution, y: ANALYST_ROW_H },
      data: { e: map.execution },
      selectable: true,
      draggable: false,
    })
  }

  return nodes
}

const GREY = { stroke: "var(--muted-foreground)", strokeOpacity: 0.4, strokeWidth: 1.5 }
const BLUE = { stroke: "var(--info)", strokeWidth: 2 }

function greyMarker() {
  return { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)", width: 16, height: 16 }
}
function blueMarker() {
  return { type: MarkerType.ArrowClosed, color: "var(--info)", width: 18, height: 18 }
}

/**
 * Edges for the map, with the reasoning path that produced the position drawn
 * in `--info` blue. The active path runs through the selected analyst (or the
 * lead analyst by default) forward into the committee, construction, risk gate,
 * and execution. The excluded analyst's edge is dashed and labeled.
 */
export function buildEdges(map: DecisionMap, selectedId: string | null): Edge[] {
  const edges: Edge[] = []

  const selectedAnalyst = map.analysts.find(
    (a) => analystNodeId(a.analystId) === selectedId && a.included
  )
  const leadId = selectedAnalyst?.analystId ?? map.primaryAnalystId

  const spineHead = map.construction ? "e_committee_construction" : "e_committee_risk"
  const active = new Set<string>([
    `e_data_${leadId}`,
    `e_${leadId}_committee`,
    spineHead,
  ])
  if (map.construction) active.add("e_construction_risk")
  if (map.execution) active.add("e_risk_execution")

  const edge = (
    id: string,
    source: string,
    target: string,
    sourceHandle: string,
    targetHandle: string
  ): Edge => {
    const on = active.has(id)
    return {
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: "default",
      animated: false,
      selectable: false,
      focusable: false,
      style: on ? BLUE : GREY,
      markerEnd: on ? blueMarker() : greyMarker(),
    }
  }

  // Data → each analyst.
  for (const a of map.analysts) {
    edges.push(edge(`e_data_${a.analystId}`, "data", analystNodeId(a.analystId), "r", "l"))
  }

  // Analysts → committee (included solid; excluded dashed + labeled).
  for (const a of map.analysts) {
    const id = `e_${a.analystId}_committee`
    if (a.included) {
      edges.push(edge(id, analystNodeId(a.analystId), "committee", "r", "l"))
    } else {
      edges.push({
        id,
        source: analystNodeId(a.analystId),
        target: "committee",
        sourceHandle: "r",
        targetHandle: "l",
        type: "default",
        animated: false,
        selectable: false,
        focusable: false,
        label: `✕ ${a.excludedReason ?? "excluded"}`,
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 0,
        labelBgStyle: { fill: "var(--muted)" },
        labelStyle: { fill: "var(--muted-foreground)", fontSize: 11 },
        style: { ...GREY, strokeDasharray: "5 4" },
        markerEnd: greyMarker(),
      })
    }
  }

  // Committee → construction → risk (or committee → risk when no position).
  if (map.construction) {
    edges.push(edge("e_committee_construction", "committee", "construction", "r", "l"))
    edges.push(edge("e_construction_risk", "construction", "risk", "b", "t"))
  } else {
    edges.push(edge("e_committee_risk", "committee", "risk", "r", "l"))
  }

  // Risk → execution.
  if (map.execution) {
    edges.push(edge("e_risk_execution", "risk", "execution", "r", "l"))
  }

  return edges
}
