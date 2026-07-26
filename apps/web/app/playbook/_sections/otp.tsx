"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
} from "@workspace/ui/components/input-otp"
import { Label } from "@workspace/ui/components/label"

import { DemoGrid, DemoTile, Section } from "@/app/playbook/_section"

function OtpSixDemo() {
  const [code, setCode] = React.useState("")
  const isComplete = code.length === 6

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <Label htmlFor="otp-demo-6">One-time code</Label>
        <p className="text-xs text-muted-foreground">
          We sent a 6-digit code to you@example.com.
        </p>
      </div>
      <InputOTP
        id="otp-demo-6"
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        value={code}
        onChange={setCode}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <Button className="w-full" disabled={!isComplete}>
        Confirm
      </Button>
    </div>
  )
}

function OtpFourDemo() {
  const [code, setCode] = React.useState("")
  const isComplete = code.length === 4

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <Label htmlFor="otp-demo-4">One-time code</Label>
        <p className="text-xs text-muted-foreground">
          Enter the 4-digit code from SMS.
        </p>
      </div>
      <InputOTP
        id="otp-demo-4"
        maxLength={4}
        pattern={REGEXP_ONLY_DIGITS}
        value={code}
        onChange={setCode}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
      <Button className="w-full" disabled={!isComplete}>
        Confirm
      </Button>
    </div>
  )
}

export function OtpSection() {
  return (
    <Section
      id="input-otp"
      index="17"
      eyebrow="Components"
      title="One-time code"
      intro={
        <>
          Code input for two-factor and verification — one character per slot,
          with paste support, keyboard navigation, and a clearly marked active
          slot. The confirm button stays disabled until every digit is filled in.
        </>
      }
    >
      <DemoGrid cols={2}>
        <DemoTile label="<InputOTP maxLength={6} /> · 3 + 3 with separator">
          <OtpSixDemo />
        </DemoTile>

        <DemoTile label="<InputOTP maxLength={4} /> · one group">
          <OtpFourDemo />
        </DemoTile>
      </DemoGrid>
    </Section>
  )
}
