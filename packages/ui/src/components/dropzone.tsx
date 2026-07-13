"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CloudUploadIcon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

interface DropzoneProps
  extends Omit<
    React.ComponentProps<"div">,
    "onDrop" | "onDragEnter" | "onDragLeave" | "onDragOver"
  > {
  /** Called with the accepted files (after any size filtering). */
  onFiles: (files: File[]) => void
  /** Called with files that were rejected for exceeding `maxSizeBytes`. */
  onRejected?: (files: File[]) => void
  /** Forwarded to the hidden file input, e.g. "application/pdf,image/*". */
  accept?: string
  /** Allow multiple files. @default true */
  multiple?: boolean
  /** Max file size in bytes; larger files are sent to `onRejected`. */
  maxSizeBytes?: number
  disabled?: boolean
}

function Dropzone({
  onFiles,
  onRejected,
  accept,
  multiple = true,
  maxSizeBytes,
  disabled = false,
  className,
  children,
  onClick,
  onKeyDown,
  "aria-label": ariaLabel,
  ...props
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dragDepth = React.useRef(0)
  const [isDragging, setIsDragging] = React.useState(false)

  const openPicker = React.useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const emitFiles = React.useCallback(
    (list: FileList | null) => {
      if (disabled || !list || list.length === 0) return
      const files = multiple ? Array.from(list) : Array.from(list).slice(0, 1)
      const accepted: File[] = []
      const rejected: File[] = []
      for (const file of files) {
        if (maxSizeBytes != null && file.size > maxSizeBytes) {
          rejected.push(file)
        } else {
          accepted.push(file)
        }
      }
      if (rejected.length > 0) onRejected?.(rejected)
      if (accepted.length > 0) onFiles(accepted)
    },
    [disabled, multiple, maxSizeBytes, onFiles, onRejected]
  )

  const resetDrag = () => {
    dragDepth.current = 0
    setIsDragging(false)
  }

  return (
    <div
      data-slot="dropzone"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel ?? "Drag files here or click to choose"}
      aria-disabled={disabled || undefined}
      data-dragging={isDragging || undefined}
      data-disabled={disabled || undefined}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        openPicker()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          openPicker()
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault()
        if (disabled) return
        dragDepth.current += 1
        setIsDragging(true)
      }}
      onDragOver={(event) => {
        // Required for the drop event to fire.
        event.preventDefault()
        if (!disabled && event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy"
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setIsDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        resetDrag()
        emitFiles(event.dataTransfer?.files ?? null)
      }}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-none border border-dashed border-border bg-transparent p-8 text-center text-sm text-muted-foreground outline-none select-none",
        "transition-[border-color,background-color] duration-[var(--duration-fast)] ease-out-quart",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isDragging && "border-ring bg-accent",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      {...props}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          emitFiles(event.target.files)
          event.target.value = ""
        }}
      />
      {children ?? <DropzoneEmpty />}
    </div>
  )
}

function DropzoneEmpty({
  className,
  title = "Drag files here or click to choose",
  hint = "All file types supported",
  ...props
}: React.ComponentProps<"div"> & {
  title?: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div
      data-slot="dropzone-empty"
      className={cn(
        "pointer-events-none flex flex-col items-center gap-1",
        className
      )}
      {...props}
    >
      <div className="mb-2 flex size-8 shrink-0 items-center justify-center rounded-none bg-muted text-foreground">
        <HugeiconsIcon icon={CloudUploadIcon} size={16} />
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}

export { Dropzone, DropzoneEmpty }
