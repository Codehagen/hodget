"use client"

import * as React from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { DemoGrid, DemoTile, Kicker, Section } from "@/app/playbook/_section"

export function NavigationSection() {
  return (
    <Section
      id="navigation"
      index="11"
      eyebrow="Components"
      title="Navigation & disclosure"
      intro={<>Switch between views and reveal content on demand.</>}
    >
      <Kicker>Tabs</Kicker>
      <div className="mb-10 border border-border p-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">
            A high-level summary of the run, its positions, and recent metrics.
          </TabsContent>
          <TabsContent value="activity" className="text-sm text-muted-foreground">
            A running log of runs and events, newest first.
          </TabsContent>
          <TabsContent value="settings" className="text-sm text-muted-foreground">
            Preferences for notifications, data sources, and team access.
          </TabsContent>
        </Tabs>
      </div>

      <Kicker>Accordion</Kicker>
      <div className="mb-10 border border-border p-6">
        <Accordion className="w-full">
          <AccordionItem value="1">
            <AccordionTrigger>How often does a cycle run?</AccordionTrigger>
            <AccordionContent>
              A cycle runs on the schedule you configure; each one produces a new
              run you can inspect.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="2">
            <AccordionTrigger>Can I change the universe?</AccordionTrigger>
            <AccordionContent>
              Yes, adjust the tradable universe anytime from the strategy
              settings.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="3">
            <AccordionTrigger>Who can promote a strategy?</AccordionTrigger>
            <AccordionContent>
              Any workspace owner or admin can promote a validated strategy from
              paper to live.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <Kicker>Breadcrumb</Kicker>
      <DemoGrid>
        <DemoTile label="breadcrumb">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Runs</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>run_9f2a10</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
