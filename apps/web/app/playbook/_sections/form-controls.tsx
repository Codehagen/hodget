"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { Input } from "@workspace/ui/components/input"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"

import { DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

export function FormControlsSection() {
  const [date, setDate] = React.useState<Date | undefined>(undefined)

  return (
    <Section
      id="form-controls"
      index="12"
      eyebrow="Components"
      title="Form controls"
      intro={
        <>
          The inputs a dashboard actually needs — with Input Group front and
          center for prefixed URLs, numeric amounts, and inline search.
        </>
      }
    >
      <DemoGrid cols={2}>
        <DemoTile label="InputGroup — URL">
          <InputGroup className="w-full max-w-xs">
            <InputGroupAddon>
              <InputGroupText>hodget.dev/</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput placeholder="my-strategy" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton>Copy</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </DemoTile>

        <DemoTile label="InputGroup — amount">
          <InputGroup className="w-full max-w-xs">
            <InputGroupAddon>
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput placeholder="0.00" />
            <InputGroupAddon align="inline-end">
              <InputGroupText>USD</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </DemoTile>

        <DemoTile label="InputGroup — search">
          <InputGroup className="w-full max-w-xs">
            <InputGroupAddon>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="size-4"
              >
                <path
                  d="M7 12a5 5 0 100-10 5 5 0 000 10zM10.5 10.5L14 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </InputGroupAddon>
            <InputGroupInput placeholder="Search…" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton>Clear</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </DemoTile>

        <DemoTile label="Select — currency">
          <Select defaultValue="usd">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usd">USD</SelectItem>
              <SelectItem value="eur">EUR</SelectItem>
              <SelectItem value="nok">NOK</SelectItem>
            </SelectContent>
          </Select>
        </DemoTile>

        <DemoTile label="Combobox">
          <Popover>
            <PopoverTrigger
              render={<Button variant="outline">Select strategy…</Button>}
            />
            <PopoverContent className="w-56 p-0">
              <Command>
                <CommandInput placeholder="Search…" />
                <CommandList>
                  <CommandEmpty>None found.</CommandEmpty>
                  <CommandGroup>
                    {["Momentum", "Value", "Trend"].map((c) => (
                      <CommandItem key={c}>{c}</CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </DemoTile>

        <DemoTile label="Date Picker">
          <Popover>
            <PopoverTrigger
              render={<Button variant="outline">Pick a date</Button>}
            />
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </PopoverContent>
          </Popover>
        </DemoTile>

        <DemoTile label="RadioGroup">
          <RadioGroup defaultValue="backtest" className="flex flex-col gap-2">
            {["backtest", "paper", "live"].map((v) => (
              <label
                key={v}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <RadioGroupItem value={v} />
                {v}
              </label>
            ))}
          </RadioGroup>
        </DemoTile>

        <DemoTile label="Field — Textarea">
          <Field className="w-full max-w-xs">
            <FieldLabel htmlFor="note">Note</FieldLabel>
            <Textarea id="note" placeholder="Write a note…" />
            <FieldDescription>Visible to your team only.</FieldDescription>
          </Field>
        </DemoTile>

        <DemoTile label="Field — error">
          <Field className="w-full max-w-xs">
            <FieldLabel htmlFor="capital">Capital</FieldLabel>
            <Input id="capital" defaultValue="-40" placeholder="0.00" />
            <FieldError>Capital must be greater than zero.</FieldError>
          </Field>
        </DemoTile>

        <DemoTile label="Kbd">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
