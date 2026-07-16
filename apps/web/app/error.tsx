"use client"

import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

/**
 * Root error boundary. Every server-rendered surface below the root layout —
 * including the session guard's database lookup — can throw; without this the
 * user gets the bare Next.js 500. Kept deliberately dependency-free: no data
 * access, so it can never fail for the same reason the page did.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm motion-safe:animate-fade-in">
        <CardHeader>
          <CardTitle className="text-base">Something went wrong</CardTitle>
          <CardDescription>
            The page hit an unexpected error. It has been logged
            {error.digest ? (
              <>
                {" "}
                (reference <span className="font-mono">{error.digest}</span>)
              </>
            ) : null}
            . Try again, or head back to the start.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/" />}>
            Back to home
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
