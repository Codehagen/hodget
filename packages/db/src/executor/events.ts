/**
 * Per-run progress events and the emitter that carries them (plan 002 phase 5a:
 * "SSE/stream progress — per-run emitter, no global state").
 *
 * The guarantee that matters: **two concurrent runs must not cross-talk.** That is
 * structural here — each run gets its **own** {@link RunEmitter} instance, and a
 * subscriber to one emitter can never observe another run's events because they
 * are different objects. The {@link RunRegistry} is only a runId → emitter lookup
 * so a separate SSE request can find the live run's emitter; it holds no event
 * state and mixes no runs.
 */

export type RunEvent =
  | { readonly type: "started"; readonly runId: string; readonly at: string }
  | {
      readonly type: "progress"
      readonly runId: string
      readonly asOf: string
      /** 1-based index of this decision day among the days seen so far. */
      readonly day: number
    }
  | {
      readonly type: "analyst"
      readonly runId: string
      readonly analystId: string
      readonly securityId: string
      readonly asOf: string
    }
  | { readonly type: "completed"; readonly runId: string; readonly at: string }
  | {
      readonly type: "failed"
      readonly runId: string
      readonly error: string
      readonly at: string
    }

/** Terminal events after which no further events will be emitted for a run. */
export function isTerminal(event: RunEvent): boolean {
  return event.type === "completed" || event.type === "failed"
}

export type RunEventListener = (event: RunEvent) => void

/**
 * A single run's event channel. Synchronous fan-out to current subscribers; it
 * does not buffer history, so a late subscriber only sees events from the moment
 * it subscribes (the run's persisted status covers what it missed).
 */
export interface RunEmitter {
  readonly runId: string
  emit(event: RunEvent): void
  subscribe(listener: RunEventListener): () => void
}

export function createRunEmitter(runId: string): RunEmitter {
  const listeners = new Set<RunEventListener>()
  return {
    runId,
    emit(event) {
      // Copy first: a listener may unsubscribe itself during dispatch.
      for (const listener of [...listeners]) listener(event)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * A runId → live emitter map. In-process only: the run executor registers its
 * emitter on start and removes it on completion, and the SSE handler looks it up.
 * A run absent from the registry has already finished (or never launched here) —
 * the caller falls back to the persisted run status. Injectable so tests and the
 * app each own their instance; there is no module-global default.
 */
export class RunRegistry {
  private readonly emitters = new Map<string, RunEmitter>()

  register(emitter: RunEmitter): void {
    this.emitters.set(emitter.runId, emitter)
  }

  get(runId: string): RunEmitter | undefined {
    return this.emitters.get(runId)
  }

  unregister(runId: string): void {
    this.emitters.delete(runId)
  }
}
