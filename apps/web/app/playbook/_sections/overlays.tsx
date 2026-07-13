"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

export function OverlaysSection() {
  return (
    <Section
      id="overlays"
      index="10"
      eyebrow="Components"
      title="Overlays"
      intro={
        <>
          Floating surfaces that open over the page — modals, side panels,
          popovers, tooltips, and a command palette.
        </>
      }
    >
      <DemoGrid>
        <DemoTile label="Dialog">
          <Dialog>
            <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit run</DialogTitle>
                <DialogDescription>
                  Update the details and save your changes.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Cancel</Button>} />
                <Button>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DemoTile>

        <DemoTile label="AlertDialog">
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive">Delete</Button>}
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the run and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DemoTile>

        <DemoTile label="Sheet">
          <Sheet>
            <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Details</SheetTitle>
                <SheetDescription>
                  A side panel for secondary content.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </DemoTile>

        <DemoTile label="Drawer">
          <Drawer>
            <DrawerTrigger render={<Button variant="outline">Open drawer</Button>} />
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Quick actions</DrawerTitle>
                <DrawerDescription>
                  A panel that slides up from the bottom.
                </DrawerDescription>
              </DrawerHeader>
            </DrawerContent>
          </Drawer>
        </DemoTile>

        <DemoTile label="Popover">
          <Popover>
            <PopoverTrigger render={<Button variant="outline">Open popover</Button>} />
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>Notifications</PopoverTitle>
                <PopoverDescription>
                  You&rsquo;re all caught up for today.
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        </DemoTile>

        <DemoTile label="Tooltip">
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
            <TooltipContent>Starts a new backtest</TooltipContent>
          </Tooltip>
        </DemoTile>

        <DemoTile label="Command" className="justify-start">
          <Command className="w-full max-w-sm border border-border">
            <CommandInput placeholder="Type a command…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Actions">
                <CommandItem>
                  New run
                  <CommandShortcut>⌘N</CommandShortcut>
                </CommandItem>
                <CommandItem>Search</CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Navigation">
                <CommandItem>Go to dashboard</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
