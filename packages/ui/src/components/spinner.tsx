import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

function Spinner({
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "strokeWidth">) {
  return (
    <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} data-slot="spinner" role="status" aria-label="Loading" className={cn(
        // 0.6s, not Tailwind's 1s default — a faster spinner reads as a faster
        // app at the same load time.
        "size-4 animate-spin [animation-duration:0.6s]",
        className,
      )} {...props} />
  )
}

export { Spinner }
