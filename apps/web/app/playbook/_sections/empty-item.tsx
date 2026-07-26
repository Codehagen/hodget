"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"

import { DemoGrid, DemoTile, Kicker, Section } from "@/app/playbook/_section"

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-6",
}

function FolderIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}
function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className ?? iconProps.className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function MoreIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  )
}

export function EmptyItemSection() {
  return (
    <Section
      id="empty-item"
      index="14"
      eyebrow="Components"
      title="Empty states & items"
      intro={
        <>
          Empty states for zero-data views, and Item rows for lists of content —
          the building blocks for results, settings, and member lists.
        </>
      }
    >
      <Kicker>Empty states</Kicker>
      <DemoGrid cols={2}>
        <DemoTile label="Empty — default">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderIcon />
              </EmptyMedia>
              <EmptyTitle>No runs</EmptyTitle>
              <EmptyDescription>
                You have not started any runs yet.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm">New run</Button>
            </EmptyContent>
          </Empty>
        </DemoTile>

        <DemoTile label="Empty — outline">
          <Empty className="border border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon />
              </EmptyMedia>
              <EmptyTitle>All caught up</EmptyTitle>
              <EmptyDescription>You have no new notifications.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </DemoTile>

        <DemoTile label="Empty — input group">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>No results</EmptyTitle>
              <EmptyDescription>Try a different search term.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <InputGroup className="max-w-56">
                <InputGroupAddon>
                  <SearchIcon className="size-4" />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search…" />
              </InputGroup>
            </EmptyContent>
          </Empty>
        </DemoTile>

        <DemoTile label="Empty — avatar media">
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <Avatar className="size-12">
                  <AvatarFallback>CH</AvatarFallback>
                </Avatar>
              </EmptyMedia>
              <EmptyTitle>Invite your team</EmptyTitle>
              <EmptyDescription>
                No members yet — invite someone to collaborate.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" variant="outline">
                Invite
              </Button>
            </EmptyContent>
          </Empty>
        </DemoTile>
      </DemoGrid>

      <Kicker>Items</Kicker>
      <div className="flex flex-col gap-4">
        <ItemGroup className="border border-border">
          <Item>
            <ItemMedia variant="icon">
              <HomeIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Dashboard</ItemTitle>
              <ItemDescription>Overview of your workspace.</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="ghost">
                Open
              </Button>
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemMedia>
              <Avatar>
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Alex Brown</ItemTitle>
              <ItemDescription>alex@acme.com</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="icon" variant="ghost" aria-label="More actions">
                <MoreIcon />
              </Button>
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item render={<a href="#" />}>
            <ItemMedia variant="icon">
              <FolderIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Strategies</ItemTitle>
              <ItemDescription>Rendered as a link.</ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Item variant="default">
            <ItemContent>
              <ItemTitle>default</ItemTitle>
              <ItemDescription>variant</ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>outline</ItemTitle>
              <ItemDescription>variant</ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>muted</ItemTitle>
              <ItemDescription>variant</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      </div>
    </Section>
  )
}
