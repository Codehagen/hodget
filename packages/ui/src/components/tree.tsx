"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

/* -------------------------------------------------------------------------
 * Tree — a generic, composable tree for folder/file navigation.
 *
 * Composition (not data-driven):
 *
 *   <Tree defaultExpanded={["docs"]} selected={id} onSelectedChange={setId}>
 *     <TreeItem id="docs">
 *       <TreeItemTrigger icon={<HugeiconsIcon icon={Folder01Icon} size={16} />}>
 *         Documents
 *       </TreeItemTrigger>
 *       <TreeItemContent>
 *         <TreeLeaf id="docs-1">Overview</TreeLeaf>
 *       </TreeItemContent>
 *     </TreeItem>
 *   </Tree>
 *
 * Keyboard: up/down arrows move between visible rows (roving tabindex),
 * right arrow opens / enters a folder, left arrow closes / goes to the parent,
 * Home/End jump to the first/last row, Enter/Space activates the row.
 * ------------------------------------------------------------------------- */

function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void
): [T, (next: T) => void] {
  const [internal, setInternal] = React.useState<T>(defaultValue)
  const controlled = value !== undefined
  const current = controlled ? value : internal
  const setValue = React.useCallback(
    (next: T) => {
      if (!controlled) setInternal(next)
      onChange?.(next)
    },
    [controlled, onChange]
  )
  return [current, setValue]
}

type TreeContextValue = {
  selected: string | null
  select: (id: string) => void
  isExpanded: (id: string) => boolean
  setItemExpanded: (id: string, open: boolean) => void
  activeId: string | null
  setActiveId: (id: string) => void
}

const TreeContext = React.createContext<TreeContextValue | null>(null)

function useTreeContext(component: string) {
  const context = React.useContext(TreeContext)
  if (!context) {
    throw new Error(`<${component} /> must be used inside <Tree />.`)
  }
  return context
}

/** Nesting level (aria-level); TreeItemContent increments by 1 per level. */
const TreeLevelContext = React.createContext(1)

type TreeItemContextValue = { id: string; open: boolean }

const TreeItemContext = React.createContext<TreeItemContextValue | null>(null)

function useTreeItemContext(component: string) {
  const context = React.useContext(TreeItemContext)
  if (!context) {
    throw new Error(`<${component} /> must be used inside <TreeItem />.`)
  }
  return context
}

/* ----------------------------------- Tree -------------------------------- */

type TreeProps = React.ComponentProps<"div"> & {
  /** Uncontrolled: ids that are open on first render. */
  defaultExpanded?: string[]
  /** Controlled: ids that are open. */
  expanded?: string[]
  onExpandedChange?: (expanded: string[]) => void
  /** Uncontrolled: selected row on first render. */
  defaultSelected?: string | null
  /** Controlled: selected row (single-select). */
  selected?: string | null
  onSelectedChange?: (selected: string | null) => void
}

function Tree({
  className,
  children,
  defaultExpanded,
  expanded,
  onExpandedChange,
  defaultSelected,
  selected,
  onSelectedChange,
  onKeyDown,
  onFocus,
  ...props
}: TreeProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)

  const [expandedValue, setExpandedValue] = useControllableState<string[]>(
    expanded,
    defaultExpanded ?? [],
    onExpandedChange
  )
  const [selectedValue, setSelectedValue] = useControllableState<string | null>(
    selected,
    defaultSelected ?? null,
    onSelectedChange
  )

  // Roving tabindex: the row with activeId has tabIndex 0, the rest -1.
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const setItemExpanded = React.useCallback(
    (id: string, open: boolean) => {
      const has = expandedValue.includes(id)
      if (open && !has) setExpandedValue([...expandedValue, id])
      else if (!open && has) {
        setExpandedValue(expandedValue.filter((value) => value !== id))
      }
    },
    [expandedValue, setExpandedValue]
  )

  const contextValue = React.useMemo<TreeContextValue>(
    () => ({
      selected: selectedValue,
      select: setSelectedValue,
      isExpanded: (id) => expandedValue.includes(id),
      setItemExpanded,
      activeId,
      setActiveId,
    }),
    [selectedValue, setSelectedValue, expandedValue, setItemExpanded, activeId]
  )

  // Ensure exactly one visible row is tabbable — even when the row that
  // held the focus stop disappears because its parent was collapsed.
  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (
      activeId &&
      root.querySelector(`[data-tree-id="${CSS.escape(activeId)}"]`)
    ) {
      return
    }
    const fallback =
      (selectedValue &&
        root.querySelector<HTMLElement>(
          `[data-tree-id="${CSS.escape(selectedValue)}"]`
        )) ||
      root.querySelector<HTMLElement>("[data-tree-id]")
    const nextId = fallback?.getAttribute("data-tree-id") ?? null
    if (nextId !== activeId) setActiveId(nextId)
  }, [activeId, expandedValue, selectedValue])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented) return

    const root = rootRef.current
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[role="treeitem"]'
    )
    if (!root || !target) return

    // Content only renders when open, so every match is a visible row.
    const rows = Array.from(
      root.querySelectorAll<HTMLElement>('[role="treeitem"]')
    )
    const index = rows.indexOf(target)
    if (index === -1) return

    const id = target.getAttribute("data-tree-id")
    const expandedAttr = target.getAttribute("aria-expanded")

    switch (event.key) {
      case "ArrowDown":
        rows[index + 1]?.focus()
        event.preventDefault()
        break
      case "ArrowUp":
        rows[index - 1]?.focus()
        event.preventDefault()
        break
      case "ArrowRight": {
        if (expandedAttr === "false" && id) {
          setItemExpanded(id, true)
        } else if (expandedAttr === "true") {
          // The first child is the next visible row — but only if it actually
          // lives inside this folder.
          const next = rows[index + 1]
          if (next && target.parentElement?.contains(next)) next.focus()
        }
        event.preventDefault()
        break
      }
      case "ArrowLeft": {
        if (expandedAttr === "true" && id) {
          setItemExpanded(id, false)
        } else {
          const group = target.closest('[role="group"]')
          group?.parentElement
            ?.querySelector<HTMLElement>(':scope > [role="treeitem"]')
            ?.focus()
        }
        event.preventDefault()
        break
      }
      case "Home":
        rows[0]?.focus()
        event.preventDefault()
        break
      case "End":
        rows[rows.length - 1]?.focus()
        event.preventDefault()
        break
    }
  }

  function handleFocus(event: React.FocusEvent<HTMLDivElement>) {
    onFocus?.(event)
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      '[role="treeitem"]'
    )
    const id = row?.getAttribute("data-tree-id")
    if (id) setActiveId(id)
  }

  return (
    <TreeContext.Provider value={contextValue}>
      <div
        ref={rootRef}
        role="tree"
        data-slot="tree"
        className={cn("flex w-full min-w-0 flex-col gap-px text-sm", className)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        {...props}
      >
        {children}
      </div>
    </TreeContext.Provider>
  )
}

/* --------------------------------- Raddeler ------------------------------ */

const treeRowClasses =
  "group/tree-row flex h-8 w-full min-w-0 select-none items-center gap-1.5 rounded-none border border-transparent px-2 text-sm text-foreground outline-none transition-colors duration-[var(--duration-instant)] hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 aria-selected:bg-accent aria-selected:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0"

function TreeRowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      data-slot="tree-row-icon"
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center text-muted-foreground group-aria-selected/tree-row:text-accent-foreground [&_svg:not([class*='size-'])]:size-4"
    >
      {children}
    </span>
  )
}

function TreeRowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span data-slot="tree-row-label" className="min-w-0 flex-1 truncate text-left">
      {children}
    </span>
  )
}

function TreeRowTrailing({ children }: { children: React.ReactNode }) {
  return (
    <span
      data-slot="tree-row-trailing"
      className="flex shrink-0 items-center gap-1"
    >
      {children}
    </span>
  )
}

/* --------------------------------- TreeItem ------------------------------ */

type TreeItemProps = Omit<React.ComponentProps<"div">, "id"> & {
  /** Unique node id — used for expand state, not as a DOM id. */
  id: string
}

function TreeItem({ id, className, children, ...props }: TreeItemProps) {
  const { isExpanded } = useTreeContext("TreeItem")
  const open = isExpanded(id)
  const itemContext = React.useMemo(() => ({ id, open }), [id, open])

  return (
    <TreeItemContext.Provider value={itemContext}>
      <div
        data-slot="tree-item"
        data-state={open ? "open" : "closed"}
        className={cn("flex w-full min-w-0 flex-col gap-px", className)}
        {...props}
      >
        {children}
      </div>
    </TreeItemContext.Provider>
  )
}

/* ----------------------------- TreeItemTrigger --------------------------- */

type TreeItemTriggerProps = React.ComponentProps<"button"> & {
  /** Icon slot (e.g. a folder icon) — rendered between the chevron and label. */
  icon?: React.ReactNode
  /** Optional trailing slot for a badge/count, right-aligned. */
  trailing?: React.ReactNode
}

function TreeItemTrigger({
  icon,
  trailing,
  className,
  children,
  onClick,
  ...props
}: TreeItemTriggerProps) {
  const { setItemExpanded, activeId } = useTreeContext("TreeItemTrigger")
  const { id, open } = useTreeItemContext("TreeItemTrigger")
  const level = React.useContext(TreeLevelContext)

  return (
    <button
      type="button"
      data-slot="tree-item-trigger"
      data-tree-id={id}
      data-state={open ? "open" : "closed"}
      className={cn(treeRowClasses, className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setItemExpanded(id, !open)
      }}
      {...props}
      role="treeitem"
      aria-expanded={open}
      aria-level={level}
      tabIndex={activeId === id ? 0 : -1}
    >
      <span
        aria-hidden="true"
        data-slot="tree-item-chevron"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-transform duration-[var(--duration-fast)] ease-out-quad motion-reduce:transition-none",
          open && "rotate-90"
        )}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} />
      </span>
      {icon ? <TreeRowIcon>{icon}</TreeRowIcon> : null}
      <TreeRowLabel>{children}</TreeRowLabel>
      {trailing ? <TreeRowTrailing>{trailing}</TreeRowTrailing> : null}
    </button>
  )
}

/* ----------------------------- TreeItemContent --------------------------- */

function TreeItemContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open } = useTreeItemContext("TreeItemContent")
  const level = React.useContext(TreeLevelContext)

  // Conditional render (not hidden DOM): robust against roving tabindex,
  // aria-visibility, and focus in hidden subtrees.
  if (!open) return null

  return (
    <TreeLevelContext.Provider value={level + 1}>
      <div
        role="group"
        data-slot="tree-item-content"
        className={cn(
          "ml-[15px] flex min-w-0 flex-col gap-px border-l border-border/60 pl-1.5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TreeLevelContext.Provider>
  )
}

/* --------------------------------- TreeLeaf ------------------------------ */

type TreeLeafProps = Omit<React.ComponentProps<"button">, "id"> & {
  /** Unique node id — used for selected state, not as a DOM id. */
  id: string
  /** Icon slot (e.g. a file icon). */
  icon?: React.ReactNode
  /** Optional trailing slot for a badge/count, right-aligned. */
  trailing?: React.ReactNode
}

function TreeLeaf({
  id,
  icon,
  trailing,
  className,
  children,
  onClick,
  ...props
}: TreeLeafProps) {
  const { selected, select, activeId } = useTreeContext("TreeLeaf")
  const level = React.useContext(TreeLevelContext)

  return (
    <button
      type="button"
      data-slot="tree-leaf"
      data-tree-id={id}
      className={cn(treeRowClasses, className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) select(id)
      }}
      {...props}
      role="treeitem"
      aria-selected={selected === id}
      aria-level={level}
      tabIndex={activeId === id ? 0 : -1}
    >
      {/* Spacer the width of the chevron so leaf nodes align with folders. */}
      <span aria-hidden="true" className="size-4 shrink-0" />
      {icon ? <TreeRowIcon>{icon}</TreeRowIcon> : null}
      <TreeRowLabel>{children}</TreeRowLabel>
      {trailing ? <TreeRowTrailing>{trailing}</TreeRowTrailing> : null}
    </button>
  )
}

export { Tree, TreeItem, TreeItemTrigger, TreeItemContent, TreeLeaf }
export type { TreeProps, TreeItemProps, TreeItemTriggerProps, TreeLeafProps }
