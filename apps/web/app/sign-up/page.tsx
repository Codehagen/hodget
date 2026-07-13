import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { AuthForm } from "@/components/auth-form"
import { getSession } from "@/lib/session"

export default async function SignUpPage() {
  const session = await getSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader>
          <CardTitle className="text-base">Create your account</CardTitle>
          <CardDescription>Start using Hodget.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense>
            <AuthForm mode="sign-up" />
          </Suspense>
          <p className="text-muted-foreground text-xs">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
