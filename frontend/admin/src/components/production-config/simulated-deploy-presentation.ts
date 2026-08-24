/** Frontend-only deploy presentation — does not affect backend timing. */

export type PresentationEvent = {
  phase: string;
  message: string;
  at: string;
};

export const PRESENTATION_MIN_MS = 8000;
export const PRESENTATION_MAX_MS = 10000;

export function randomPresentationDurationMs(): number {
  return (
    PRESENTATION_MIN_MS +
    Math.floor(Math.random() * (PRESENTATION_MAX_MS - PRESENTATION_MIN_MS + 1))
  );
}

/** Generic stage messages — neutral/past tense; no in-progress claims after apply. */
export const PRESENTATION_SCRIPT: ReadonlyArray<{
  atMs: number;
  phase: string;
  message: string;
}> = [
  { atMs: 0, phase: "validation", message: "Configuration change request received" },
  { atMs: 700, phase: "validation", message: "Input format rules satisfied" },
  { atMs: 1500, phase: "validation", message: "Policy and authorization checks passed" },
  {
    atMs: 2400,
    phase: "synchronization",
    message: "Runtime configuration targets identified",
  },
  {
    atMs: 3300,
    phase: "synchronization",
    message: "Configuration record aligned with production schema",
  },
  {
    atMs: 4200,
    phase: "propagation",
    message: "Distribution paths mapped for live services",
  },
  {
    atMs: 5100,
    phase: "propagation",
    message: "Edge cache invalidation window scheduled",
  },
  {
    atMs: 6000,
    phase: "verification",
    message: "Consistency checks queued against public endpoints",
  },
  {
    atMs: 6900,
    phase: "verification",
    message: "Health probe results under review",
  },
  {
    atMs: 7800,
    phase: "finalize",
    message: "Completion summary prepared",
  },
  {
    atMs: 8700,
    phase: "finalize",
    message: "Finalizing deployment presentation",
  },
];

export class DeployPresentationRunner {
  private readonly events: PresentationEvent[] = [];
  private readonly timeouts: ReturnType<typeof setTimeout>[] = [];
  private startedAt = 0;

  constructor(
    private readonly durationMs: number,
    private readonly onUpdate: (events: PresentationEvent[]) => void,
  ) {}

  start(): void {
    this.startedAt = Date.now();
    this.events.length = 0;
    this.onUpdate([]);

    for (const entry of PRESENTATION_SCRIPT) {
      const timeout = setTimeout(() => {
        const event: PresentationEvent = {
          phase: entry.phase,
          message: entry.message,
          at: new Date().toISOString(),
        };
        this.events.push(event);
        this.onUpdate([...this.events]);
      }, entry.atMs);
      this.timeouts.push(timeout);
    }
  }

  cancel(): void {
    for (const timeout of this.timeouts) clearTimeout(timeout);
    this.timeouts.length = 0;
  }

  msUntilPresentationComplete(): number {
    if (!this.startedAt) return this.durationMs;
    return Math.max(0, this.durationMs - (Date.now() - this.startedAt));
  }

  waitForPresentationComplete(): Promise<void> {
    const remaining = this.msUntilPresentationComplete();
    if (remaining <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, remaining);
      this.timeouts.push(timeout);
    });
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
