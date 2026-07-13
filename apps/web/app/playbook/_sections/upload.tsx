"use client"

import * as React from "react"

import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { File01Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@workspace/ui/components/badge"
import { Dropzone, DropzoneEmpty } from "@workspace/ui/components/dropzone"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Progress } from "@workspace/ui/components/progress"

import { Code, DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function EmptyDropzoneDemo() {
  const [count, setCount] = React.useState(0)
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Dropzone onFiles={(files) => setCount(files.length)}>
        <DropzoneEmpty hint="CSV, Parquet and JSON" />
      </Dropzone>
      {count > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          {count} {count === 1 ? "file selected" : "files selected"}
        </div>
      )}
    </div>
  )
}

type UploadEntry = {
  id: number
  name: string
  size: number
  progress: number
}

const MAX_SIZE = 5 * 1024 * 1024

function UploadListDemo() {
  const nextId = React.useRef(3)
  const [entries, setEntries] = React.useState<UploadEntry[]>([
    { id: 1, name: "prices.csv", size: 1_240_000, progress: 0 },
    { id: 2, name: "universe.parquet", size: 3_180_000, progress: 0 },
  ])

  React.useEffect(() => {
    const timer = setInterval(() => {
      setEntries((prev) =>
        prev.some((entry) => entry.progress < 100)
          ? prev.map((entry) =>
              entry.progress >= 100
                ? entry
                : {
                    ...entry,
                    progress: Math.min(
                      100,
                      entry.progress + 4 + Math.random() * 8
                    ),
                  }
            )
          : prev
      )
    }, 150)
    return () => clearInterval(timer)
  }, [])

  const handleFiles = (files: File[]) => {
    setEntries((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: nextId.current++,
        name: file.name,
        size: file.size,
        progress: 0,
      })),
    ])
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Dropzone
        onFiles={handleFiles}
        maxSizeBytes={MAX_SIZE}
        onRejected={(files) =>
          toast.error(
            files.length === 1
              ? "File is too large (max 5 MB)"
              : `${files.length} files are too large (max 5 MB)`
          )
        }
        className="p-6"
      >
        <DropzoneEmpty hint="Max 5 MB per file" />
      </Dropzone>

      <ItemGroup className="gap-2">
        {entries.map((entry) => (
          <Item key={entry.id} variant="outline" size="sm">
            <ItemMedia variant="icon">
              <HugeiconsIcon icon={File01Icon} size={16} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{entry.name}</ItemTitle>
              {entry.progress < 100 ? (
                <div className="flex w-full items-center gap-2">
                  <Progress value={entry.progress} className="flex-1" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(entry.progress)} %
                  </span>
                </div>
              ) : (
                <ItemDescription>{formatBytes(entry.size)}</ItemDescription>
              )}
            </ItemContent>
            {entry.progress >= 100 && (
              <ItemActions>
                <Badge variant="green">Ready</Badge>
              </ItemActions>
            )}
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}

export function UploadSection() {
  return (
    <Section
      id="upload"
      index="16"
      eyebrow="Components"
      title="File upload"
      intro={
        <>
          A drag-and-drop surface built on native drag events and a hidden file
          input — no extra dependencies. The whole surface is clickable and
          keyboard accessible (Enter/Space opens the file picker), and files over
          the size limit are rejected via <Code>onRejected</Code>.
        </>
      }
    >
      <DemoGrid cols={2}>
        <DemoTile label="<Dropzone /> + <DropzoneEmpty />">
          <EmptyDropzoneDemo />
        </DemoTile>

        <DemoTile label="<Dropzone /> + file list (Item + Progress)">
          <UploadListDemo />
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
