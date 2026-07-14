"use client"

import "@xyflow/react/dist/base.css"

import * as React from "react"
import { ReactFlow, ReactFlowProvider, useNodesState } from "@xyflow/react"

import type { DecisionMap } from "./data"
import { Inspector } from "./inspector"
import { analystNodeId, buildEdges, buildNodes, STAGES } from "./layout"
import { nodeTypes } from "./nodes"

/** The five numbered stage columns, as a header band above the canvas. */
function StageHeaders() {
  return (
    <div className="grid grid-cols-5 border-b border-border">
      {STAGES.map((s) => (
        <div key={s.index} className="flex items-center gap-2 px-3 py-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground tabular-nums">
            {s.index}
          </span>
          <span className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function Flow({ map }: { map: DecisionMap }) {
  const initialNodes = React.useMemo(() => buildNodes(map), [map])
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [selectedId, setSelectedId] = React.useState<string | null>(
    analystNodeId(map.primaryAnalystId)
  )
  const edges = React.useMemo(() => buildEdges(map, selectedId), [map, selectedId])

  return (
    <div className="flex flex-col items-stretch gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 rounded-none bg-card ring-1 ring-foreground/10">
        <StageHeaders />
        <div className="h-[560px] w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
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
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.3}
            maxZoom={1.5}
          />
        </div>
      </div>
      <Inspector map={map} selectedId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}

/**
 * Read-only decision-map canvas. The graph is derived from the decision record;
 * the canvas cannot be edited (no drag, no connect, no scroll-zoom or pan) — it
 * only explains, and selecting a node opens the inspector instantly.
 */
export function DecisionFlow({ map }: { map: DecisionMap }) {
  return (
    <ReactFlowProvider>
      <Flow map={map} />
    </ReactFlowProvider>
  )
}
