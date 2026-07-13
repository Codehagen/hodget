import { HugeiconsIcon } from "@hugeicons/react"
import { DashboardSquare01Icon } from "@hugeicons/core-free-icons"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Your engine at a glance.
        </p>
      </div>
      <Empty className="flex-1 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={DashboardSquare01Icon} size={16} />
          </EmptyMedia>
          <EmptyTitle>Under construction</EmptyTitle>
          <EmptyDescription>
            Runs, strategies, and portfolio insights will surface here as the
            engine comes online.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
