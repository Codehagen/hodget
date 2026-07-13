# 004 — Migrate dialogs from keyframe utilities to the Base UI transition idiom

- **Status**: TODO
- **Commit**: ba46291
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens (with an interruptibility bonus)
- **Estimated scope**: 2 files (dialog.tsx, alert-dialog.tsx) + the reduced-motion rule in globals.css

## Problem

Three animation systems coexist. Every floating surface except the dialogs uses
Base UI's transition idiom (`transition-[opacity,transform]` +
`data-starting-style`/`data-ending-style`), which retargets mid-flight. The two
dialogs instead use tw-animate-css keyframe utilities, which restart from zero
and cannot be interrupted:

```tsx
// packages/ui/src/components/dialog.tsx:35 — current (overlay)
"fixed inset-0 isolate z-50 bg-black/10 duration-[var(--duration-fast)] supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
```

```tsx
// packages/ui/src/components/dialog.tsx:59 — current (content, excerpt)
"... ring-1 ring-foreground/10 duration-[var(--duration-fast)] outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
```

`packages/ui/src/components/alert-dialog.tsx:33` (overlay) and `:55` (content)
are identical in pattern. Meanwhile the house `--animate-fade-in` /
`--animate-scale-in` keyframes (globals.css:85-101) go unused by these
components, and the sheet/popover/menu/select/tooltip all use transitions.

Consequences: an inconsistent mental model (three systems for one job), and the
reduced-motion layer needs a special re-opt-in keyframe rule for dialogs
because their animation system differs from every sibling.

## Target

Both dialogs use the exact idiom of the sheet (exemplar:
`packages/ui/src/components/sheet.tsx:57`) — CSS transitions with
starting/ending styles, tokens for duration:

```tsx
// dialog.tsx overlay — target
"fixed inset-0 isolate z-50 bg-black/10 transition-opacity duration-[var(--duration-fast)] ease-out-quart data-starting-style:opacity-0 data-ending-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
```

```tsx
// dialog.tsx content — target (animation classes only; keep all layout/visual classes)
"... transition-[opacity,transform] duration-[var(--duration-fast)] ease-out-quart data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-ending-style:duration-[var(--duration-instant)] ..."
```

Notes:
- The content keeps its centering transform (`-translate-x-1/2 -translate-y-1/2`);
  Tailwind v4 composes `scale-95` with translate via CSS transform properties,
  matching how popover/select/tooltip already combine them. Verify visually that
  the scale is centered (it must scale around its own center — modals are
  exempt from trigger origins).
- Exit faster than enter (`--duration-instant` = 100ms out, 150ms in), matching
  popover/select/tooltip.
- Apply the same pattern to `alert-dialog.tsx:33` and `:55`.
- The command palette (`command.tsx:59,61`) currently neutralizes the dialog
  keyframes with `data-open:animate-none data-closed:animate-none`. After the
  migration those classes no longer apply to anything — replace them with
  `transition-none` so the palette stays instant.
- The reduced-motion re-opt-in rule in `globals.css:247-252` targets the dialog
  keyframe system; after migration, the dialog content/overlay transition
  `opacity` natively (which the reduced-motion layer already preserves), so the
  dialog selectors in that rule become unnecessary — but keep the rule if plan
  003 (drawer) has added drawer selectors to it, removing only the dialog
  lines, and re-test that dialogs still fade under reduced motion via their
  opacity transition.

## Repo conventions to follow

- Exemplar to imitate: `packages/ui/src/components/sheet.tsx:57`
  (`transition duration-200 data-ending-style:duration-150 ease-out-quart
  data-ending-style:opacity-0 data-starting-style:opacity-0 ...`).
- Duration tokens via `duration-[var(--duration-fast)]` (see dialog.tsx:35
  already using the token form).
- Easing token utilities: `ease-out-quart`.

## Steps

1. Rewrite the animation classes on `dialog.tsx:35` (overlay) and `:59`
   (content) per the targets above; leave every non-animation class untouched.
2. Same for `alert-dialog.tsx:33` and `:55`.
3. Update `command.tsx:59,61`: `data-open:animate-none data-closed:animate-none`
   → `transition-none` (verify the palette opens/closes with zero animation).
4. Update the reduced-motion rule in `globals.css` per the note above and
   confirm dialogs still fade (not teleport) under reduced motion.
5. Check `apps/web` for any other `animate-in`/`animate-out` usage
   (`grep -rn 'animate-in\|animate-out' packages/ui/src apps/web/app`) and
   report leftovers (do not change files outside scope).

## Boundaries

- Do NOT change dialog markup, focus handling, or portal structure.
- Do NOT remove the tw-animate-css dependency (other utilities may use it).
- Do NOT alter sheet/popover/menu/select/tooltip.
- If Base UI's Dialog does not apply `data-starting-style`/`data-ending-style`
  phases (check rendered DOM), STOP and report rather than approximating with
  keyframes.

## Verification

- **Mechanical**: `pnpm --filter @workspace/ui lint && pnpm --filter web build` — green.
- **Feel check**: `localhost:3000/playbook` → Overlays section:
  - Dialog and alert dialog open with a fade+scale from 0.95 centered, close
    faster than they open.
  - Spam the open/close trigger rapidly: the dialog must **reverse mid-flight**
    from its current position — never restart from scale 0.95 (this is the
    keyframe→transition win; check at 10% speed in the Animations panel).
  - Command palette (if demoed) opens/closes instantly.
  - Reduced-motion emulation: dialogs fade, no scale.
- **Done when**: dialogs are visually indistinguishable from before at normal
  speed except for smooth mid-flight reversal, and no `animate-in` remains on
  dialog components.
