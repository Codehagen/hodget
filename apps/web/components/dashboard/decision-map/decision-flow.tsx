"use client"

import "@xyflow/react/dist/base.css"
import "./decision-flow.css"

import * as React from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type OnSelectionChangeParams,
} from "@xyflow/react"

import type { DecisionMap } from "./data"
import { buildEdges, buildNodes, STAGES } from "./layout"
import { nodeTypes } from "./nodes"

/**
 * The five stage columns as a question-led header band above the canvas — the
 * plain-language spine of the explainer. The engine term sits under each
 * question.
 */
function StageHeaders() {
  return (
    <div className="grid grid-cols-5 gap-2 px-1 pb-3">
      {STAGES.map((s) => (
        <div key={s.index} className="flex items-start gap-2">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground tabular-nums">
            {s.index}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-xs font-medium text-foreground">{s.question}</span>
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Flow({
  map,
  selectedId,
  onSelectedIdChange,
}: {
  map: DecisionMap
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
}) {
  const initialNodes = React.useMemo(() => buildNodes(map), [map])
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const edges = React.useMemo(() => buildEdges(map, selectedId), [map, selectedId])

  // Drive selection from React Flow, which fires for pointer AND keyboard
  // (Enter/Space on a focused node) selection — onNodeClick alone was
  // mouse-only. multiSelect is off, so at most one node is ever selected.
  const handleSelectionChange = React.useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      onSelectedIdChange(selectedNodes[0]?.id ?? null)
    },
    [onSelectedIdChange]
  )

  return (
    <div className="min-w-0 flex-1">
      <StageHeaders />
      <div className="decision-map-canvas h-[480px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onSelectionChange={handleSelectionChange}
          onPaneClick={() => onSelectedIdChange(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable
          edgesFocusable={false}
          elementsSelectable
          zoomOnScroll={false}
          panOnScroll={false}
          panOnDrag={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          fitView
          fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
        />
      </div>
    </div>
  )
}

/**
 * Read-only decision-map canvas. The graph is derived from the decision record;
 * the canvas cannot be edited (no drag, no connect, no scroll-zoom or pan) — it
 * only explains. Selection is controlled by the parent so the surrounding page
 * (the advisor rail) can track the selected advisor node.
 */
export function DecisionFlow({
  map,
  selectedId,
  onSelectedIdChange,
}: {
  map: DecisionMap
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
}) {
  return (
    <ReactFlowProvider>
      <Flow map={map} selectedId={selectedId} onSelectedIdChange={onSelectedIdChange} />
    </ReactFlowProvider>
  )
}
