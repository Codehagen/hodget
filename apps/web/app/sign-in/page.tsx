import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { constructMetadata } from "@/lib/metadata"

export const metadata = constructMetadata({
  title: "Sign in",
  canonicalUrl: "/sign-in",
})

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { AuthForm } from "@/components/auth-form"
import { getSession } from "@/lib/session"

export default async function SignInPage() {
  const session = await getSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader>
          <CardTitle className="text-base">Welcome back</CardTitle>
          <CardDescription>Sign in to your Hodget account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense>
            <AuthForm mode="sign-in" />
          </Suspense>
          <p className="text-muted-foreground text-xs">
            New here?{" "}
            <Link
              href="/sign-up"
              className="text-foreground underline underline-offset-4"
            >
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
