"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryState } from "nuqs"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"

import { signIn, signUp } from "@/lib/auth-client"
import { safeRedirect } from "@/lib/safe-redirect"

type Mode = "sign-in" | "sign-up"

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [redirect] = useQueryState("redirect")
  const [isPending, setIsPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isSignUp = mode === "sign-up"

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsPending(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    const name = String(form.get("name") ?? "")
    const target = safeRedirect(redirect)

    const { error } = isSignUp
      ? await signUp.email({ name, email, password })
      : await signIn.email({ email, password })

    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.")
      setIsPending(false)
      return
    }

    // Navigate + refresh so Server Components pick up the new session cookie.
    router.push(target)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {isSignUp ? (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              disabled={isPending}
              aria-invalid={error ? true : undefined}
            />
          </Field>
        ) : null}

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
            disabled={isPending}
            aria-invalid={error ? true : undefined}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
          />
          {isSignUp ? (
            <FieldDescription>At least 8 characters.</FieldDescription>
          ) : null}
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending
            ? isSignUp
              ? "Creating account…"
              : "Signing in…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  )
}
