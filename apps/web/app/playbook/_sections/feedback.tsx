"use client"

import * as React from "react"

import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@workspace/ui/components/avatar"
import { Progress } from "@workspace/ui/components/progress"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"

import { DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

function ProgressDemo() {
  const [value, setValue] = React.useState(60)
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      <Progress value={value} className="w-full" />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setValue((v) => Math.min(100, v + 10))}
      >
        Bump +10
      </Button>
    </div>
  )
}

export function FeedbackSection() {
  return (
    <Section
      id="feedback"
      index="13"
      eyebrow="Components"
      title="Feedback & status"
      intro={
        <>
          Loading, progress, notifications, and identity — the small signals
          that tell people what just happened and who is here.
        </>
      }
    >
      <DemoGrid>
        <DemoTile label="toast()">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => toast("Saved to drafts")}>
              Show
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.success("Run started")}
            >
              Success
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.error("Something went wrong")}
            >
              Error
            </Button>
          </div>
        </DemoTile>

        <DemoTile label="<Skeleton />">
          <div className="flex w-full max-w-xs items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </DemoTile>

        <DemoTile label="<Spinner />">
          <div className="flex items-center gap-6">
            <Spinner className="size-4" />
            <Spinner className="size-8" />
          </div>
        </DemoTile>

        <DemoTile label="<Progress />">
          <ProgressDemo />
        </DemoTile>

        <DemoTile label="<Avatar />">
          <div className="flex items-center gap-6">
            <Avatar>
              <AvatarFallback>CH</AvatarFallback>
            </Avatar>
            <AvatarGroup>
              {["AB", "CD", "EF"].map((n) => (
                <Avatar key={n}>
                  <AvatarFallback>{n}</AvatarFallback>
                </Avatar>
              ))}
              <AvatarGroupCount>+5</AvatarGroupCount>
            </AvatarGroup>
          </div>
        </DemoTile>

        <DemoTile label="<Separator />">
          <div className="flex w-full max-w-xs flex-col gap-4">
            <div className="text-sm text-muted-foreground">Above</div>
            <Separator />
            <div className="flex items-center gap-3 text-sm text-foreground">
              <span>Overview</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Activity</span>
            </div>
          </div>
        </DemoTile>

        <DemoTile label="<ScrollArea />">
          <ScrollArea className="h-40 w-full max-w-xs border border-border">
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 15 }, (_, i) => (
                <div key={i} className="text-sm text-foreground">
                  Row {i + 1}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
