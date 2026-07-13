"use client"

import * as React from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import { File01Icon, Folder01Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@workspace/ui/components/badge"
import {
  Tree,
  TreeItem,
  TreeItemTrigger,
  TreeItemContent,
  TreeLeaf,
} from "@workspace/ui/components/tree"

import { DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

function FolderIcon() {
  return <HugeiconsIcon icon={Folder01Icon} size={16} strokeWidth={2} />
}

function FileIcon() {
  return <HugeiconsIcon icon={File01Icon} size={16} strokeWidth={2} />
}

/** Hierarchical index prefix ("1.2") in front of a file/folder name. */
function Idx({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1.5 font-mono text-xs text-muted-foreground">
      {children}
    </span>
  )
}

function FolderTreeDemo() {
  const [selected, setSelected] = React.useState<string | null>("1-2")

  return (
    <Tree
      aria-label="Strategy files"
      defaultExpanded={["strategies", "strategies-signals"]}
      selected={selected}
      onSelectedChange={setSelected}
      className="max-w-xs"
    >
      <TreeItem id="strategies">
        <TreeItemTrigger icon={<FolderIcon />}>
          <Idx>1</Idx>Strategies
        </TreeItemTrigger>
        <TreeItemContent>
          <TreeLeaf id="1-1" icon={<FileIcon />}>
            <Idx>1.1</Idx>momentum.yaml
          </TreeLeaf>
          <TreeLeaf id="1-2" icon={<FileIcon />}>
            <Idx>1.2</Idx>mean-reversion.yaml
          </TreeLeaf>
          <TreeItem id="strategies-signals">
            <TreeItemTrigger icon={<FolderIcon />}>
              <Idx>1.3</Idx>Signals
            </TreeItemTrigger>
            <TreeItemContent>
              <TreeLeaf id="1-3-1" icon={<FileIcon />}>
                <Idx>1.3.1</Idx>momentum.parquet
              </TreeLeaf>
              <TreeLeaf id="1-3-2" icon={<FileIcon />}>
                <Idx>1.3.2</Idx>value.parquet
              </TreeLeaf>
            </TreeItemContent>
          </TreeItem>
        </TreeItemContent>
      </TreeItem>

      <TreeItem id="runs">
        <TreeItemTrigger icon={<FolderIcon />}>
          <Idx>2</Idx>Runs
        </TreeItemTrigger>
        <TreeItemContent>
          <TreeLeaf id="2-1" icon={<FileIcon />}>
            <Idx>2.1</Idx>run_9f2a10.json
          </TreeLeaf>
          <TreeLeaf id="2-2" icon={<FileIcon />}>
            <Idx>2.2</Idx>run_9f2a11.json
          </TreeLeaf>
        </TreeItemContent>
      </TreeItem>

      <TreeItem id="reports">
        <TreeItemTrigger icon={<FolderIcon />}>
          <Idx>3</Idx>Reports
        </TreeItemTrigger>
        <TreeItemContent>
          <TreeLeaf id="3-1" icon={<FileIcon />}>
            <Idx>3.1</Idx>sharpe.csv
          </TreeLeaf>
          <TreeLeaf id="3-2" icon={<FileIcon />}>
            <Idx>3.2</Idx>drawdown.csv
          </TreeLeaf>
        </TreeItemContent>
      </TreeItem>
    </Tree>
  )
}

function BadgeTreeDemo() {
  return (
    <Tree
      aria-label="Folders with item counts"
      defaultExpanded={["configs"]}
      defaultSelected="config-2"
      className="max-w-xs"
    >
      <TreeItem id="configs">
        <TreeItemTrigger
          icon={<FolderIcon />}
          trailing={<Badge variant="neutral">3</Badge>}
        >
          Configs
        </TreeItemTrigger>
        <TreeItemContent>
          <TreeLeaf id="config-1" icon={<FileIcon />}>
            Backtest config
          </TreeLeaf>
          <TreeLeaf
            id="config-2"
            icon={<FileIcon />}
            trailing={<Badge variant="green">Active</Badge>}
          >
            Paper config
          </TreeLeaf>
          <TreeLeaf id="config-3" icon={<FileIcon />}>
            Live config
          </TreeLeaf>
        </TreeItemContent>
      </TreeItem>

      <TreeItem id="archive">
        <TreeItemTrigger
          icon={<FolderIcon />}
          trailing={<Badge variant="neutral">12</Badge>}
        >
          Archive
        </TreeItemTrigger>
        <TreeItemContent>
          <TreeLeaf id="archive-1" icon={<FileIcon />}>
            Archived runs
          </TreeLeaf>
        </TreeItemContent>
      </TreeItem>

      <TreeItem id="shared">
        <TreeItemTrigger
          icon={<FolderIcon />}
          trailing={<Badge variant="neutral">5</Badge>}
        >
          Shared with me
        </TreeItemTrigger>
        <TreeItemContent>
          <TreeLeaf id="shared-1" icon={<FileIcon />}>
            Universe · US Equities
          </TreeLeaf>
        </TreeItemContent>
      </TreeItem>
    </Tree>
  )
}

export function TreeSection() {
  return (
    <Section
      id="tree"
      index="18"
      eyebrow="Components"
      title="Tree & folders"
      intro={
        <>
          A composable tree for folder and file navigation. Arrow keys move focus
          between visible rows, right/left open and close folders, and a single
          row can be selected. Expand and selected state can be controlled or
          uncontrolled.
        </>
      }
    >
      <DemoGrid cols={2}>
        <DemoTile label="<Tree defaultExpanded selected />" className="items-start justify-start">
          <FolderTreeDemo />
        </DemoTile>

        <DemoTile
          label='TreeItemTrigger trailing={<Badge />}'
          className="items-start justify-start"
        >
          <BadgeTreeDemo />
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
