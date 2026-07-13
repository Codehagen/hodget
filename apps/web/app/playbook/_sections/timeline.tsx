"use client"

import * as React from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Rocket01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineIcon,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from "@workspace/ui/components/timeline"

import { DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

const events = [
  {
    id: "committee-approved",
    icon: CheckmarkCircle02Icon,
    title: (
      <>
        <strong>Committee</strong> approved 3 positions
      </>
    ),
    description: "Portfolio construction passed all risk gates.",
    time: "today 09:41",
    dateTime: "2026-07-03T09:41",
  },
  {
    id: "run-completed",
    icon: ViewIcon,
    title: (
      <>
        <strong>Backtest</strong> completed
      </>
    ),
    description: "Momentum · Large Cap finished in 4 minutes.",
    time: "today 08:12",
    dateTime: "2026-07-03T08:12",
  },
  {
    id: "risk-blocked",
    icon: Alert02Icon,
    title: (
      <>
        <strong>Risk engine</strong> blocked a position
      </>
    ),
    description: "Exposure limit exceeded for a single name.",
    time: "Jul 1, 2026",
    dateTime: "2026-07-01",
  },
  {
    id: "run-queued",
    icon: Rocket01Icon,
    title: (
      <>
        <strong>Scheduler</strong> queued a run
      </>
    ),
    description: "Momentum · Large Cap, backtest mode.",
    time: "Jun 30, 2026",
    dateTime: "2026-06-30",
  },
]

const compactEvents = [
  {
    id: "completed",
    icon: CheckmarkCircle02Icon,
    title: <>Backtest completed</>,
    time: "09:41",
    dateTime: "2026-07-03T09:41",
  },
  {
    id: "queued",
    icon: Rocket01Icon,
    title: <>Run queued</>,
    time: "yesterday 14:02",
    dateTime: "2026-07-02T14:02",
  },
  {
    id: "blocked",
    icon: Alert02Icon,
    title: <>Position blocked</>,
    time: "Jun 30",
    dateTime: "2026-06-30",
  },
]

export function TimelineSection() {
  return (
    <Section
      id="timeline"
      index="19"
      eyebrow="Components"
      title="Timeline"
      intro={
        <>
          Activity and audit log — who did what, when. Each event has an icon,
          an actor, a description, and a timestamp, and the line between the
          icons hides automatically on the last row.
        </>
      }
    >
      <DemoGrid cols={2}>
        <DemoTile label="<Timeline /> — activity log">
          <div className="w-full max-w-sm">
            <Timeline>
              {events.map((event) => (
                <TimelineItem key={event.id}>
                  <TimelineConnector />
                  <TimelineIcon>
                    <HugeiconsIcon icon={event.icon} size={14} />
                  </TimelineIcon>
                  <TimelineContent>
                    <TimelineTitle>{event.title}</TimelineTitle>
                    <TimelineDescription>
                      {event.description}
                    </TimelineDescription>
                    <TimelineTime dateTime={event.dateTime}>
                      {event.time}
                    </TimelineTime>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </div>
        </DemoTile>

        <DemoTile label="compact — time right-aligned">
          <div className="w-full max-w-sm">
            <Timeline>
              {compactEvents.map((event) => (
                <TimelineItem key={event.id}>
                  <TimelineConnector />
                  <TimelineIcon>
                    <HugeiconsIcon icon={event.icon} size={14} />
                  </TimelineIcon>
                  <TimelineContent className="flex-row items-baseline justify-between gap-3">
                    <TimelineTitle>{event.title}</TimelineTitle>
                    <TimelineTime dateTime={event.dateTime}>
                      {event.time}
                    </TimelineTime>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </div>
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
