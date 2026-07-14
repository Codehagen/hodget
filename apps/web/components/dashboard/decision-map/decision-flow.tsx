"use client"

import "@xyflow/react/dist/base.css"
import "./decision-flow.css"

import * as React from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
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
  const { fitView } = useReactFlow()
  const canvasRef = React.useRef<HTMLDivElement>(null)

  // The canvas is read-only (no user pan/zoom), so re-fit whenever the
  // container resizes. This also covers the case that matters on the Decisions
  // page: the Full-decision-path tab is `keepMounted`, so it first mounts
  // hidden (0×0) while Summary is the default tab — a one-shot init `fitView`
  // would strand the graph at the wrong zoom. Re-fitting on the hidden→visible
  // resize lands it correctly, and makes the canvas responsive besides.
  React.useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        fitView({ padding: 0.08, maxZoom: 1 })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitView])

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
      <div ref={canvasRef} className="decision-map-canvas h-[480px] w-full">
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
