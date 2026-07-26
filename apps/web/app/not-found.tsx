import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm motion-safe:animate-fade-in">
        <CardHeader>
          <CardTitle className="text-base">Page not found</CardTitle>
          <CardDescription>
            This page doesn&apos;t exist — the run, decision, or route may have
            been removed, or the link is wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button size="sm" render={<Link href="/" />}>
            Back to home
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/demo" />}>
            Explore the demo
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
