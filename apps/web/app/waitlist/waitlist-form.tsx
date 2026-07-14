"use client"

import { useActionState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { joinWaitlist, type WaitlistState } from "./actions"

const initialState: WaitlistState = { status: "idle" }

/**
 * Waitlist signup form. Wraps the `joinWaitlist` server action with
 * `useActionState` for pending + result state. On success the form is replaced
 * by a confirmation; errors render inline (email) or below the form (generic).
 */
export function WaitlistForm({ source = "landing" }: { source?: string }) {
  const [state, formAction, pending] = useActionState(
    joinWaitlist,
    initialState
  )

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-1.5" aria-live="polite">
        <p className="text-sm font-medium text-foreground">{state.message}</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email you when your invite is ready.
        </p>
      </div>
    )
  }

  const emailError =
    state.status === "error" && state.field === "email" ? state.message : null
  const formError =
    state.status === "error" && !state.field ? state.message : null

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="source" value={source} />
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={pending}
          aria-invalid={emailError ? true : undefined}
          // ≥16px to prevent iOS zoom on focus (Design.md forms rules). The
          // md:text-base override beats the Input default's md:text-xs.
          className="h-11 text-base md:text-base"
        />
        {emailError ? <FieldError>{emailError}</FieldError> : null}
      </Field>
      {formError ? (
        <FieldError aria-live="polite">{formError}</FieldError>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Joining…" : "Join the waitlist"}
      </Button>
    </form>
  )
}
