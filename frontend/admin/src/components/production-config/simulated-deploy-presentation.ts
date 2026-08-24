export type PresentationEvent = {
  phase: string;
  message: string;
  at: string;
  progress?: number;
};

type Scenario = "fast" | "normal" | "slow" | "very_slow";

type ScheduledEntry = {
  atMs: number;
  phase: string;
  message: string;
  progress: number;
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickMany<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function pickScenario(): Scenario {
  const r = Math.random();
  if (r < 0.3) return "fast";
  if (r < 0.7) return "normal";
  if (r < 0.9) return "slow";
  return "very_slow";
}

function pickTargetDurationMs(scenario: Scenario): number {
  switch (scenario) {
    case "fast":
      return randInt(5000, 9000);
    case "normal":
      return randInt(9000, 15000);
    case "slow":
      return randInt(15000, 20000);
    case "very_slow":
      return randInt(20000, 30000);
  }
}

function organicProgress(current: number, cap = 96): number {
  if (Math.random() < 0.28) {
    return Math.min(cap, current + randInt(0, 2));
  }
  const jump = randInt(3, 18);
  return Math.min(cap, current + jump);
}

const OPENING_MESSAGES = [
  "Initializing configuration update…",
  "Starting configuration sync…",
  "Initializing update…",
  "Checking configuration state…",
  "Starting synchronization…",
  "Preparing configuration…",
  "Starting configuration update…",
  "Initializing deployment…",
] as const;

const VALIDATION_MESSAGES = [
  "Validating configuration",
  "Validating Pixel configuration",
  "Checking Meta Pixel configuration",
  "Running pre-flight checks",
  "Pre-flight validation complete",
  "Validating deployment requirements",
  "Checking deployment prerequisites",
  "Configuration validated",
  "Existing configuration detected",
  "Reviewing configuration change request",
] as const;

const PREPARE_MESSAGES = [
  "Preparing deployment payload",
  "Preparing synchronization payload",
  "Preparing update payload",
  "Preparing deployment",
  "Preparing update",
  "Preparing synchronization",
  "Uploading configuration changes",
  "Sending configuration update",
  "Sending configuration payload",
  "Loading deployment resources…",
  "Preparing deployment resources",
] as const;

const SYNC_MESSAGES = [
  "Syncing configuration",
  "Syncing configuration…",
  "Synchronizing remote state…",
  "Synchronizing configuration",
  "Updating environment state",
  "Waiting for synchronization response…",
  "Waiting for synchronization…",
  "Remote configuration acknowledged",
  "Configuration accepted",
  "Remote state updated",
] as const;

const WAIT_MESSAGES = [
  "Waiting for remote response…",
  "Connection is responding slowly…",
  "Waiting for remote response…",
  "Verifying configuration propagation…",
  "Running deployment checks…",
  "Waiting for deployment response…",
  "Deployment endpoint responding slowly",
  "Retrying synchronization request…",
  "Re-establishing synchronization…",
  "Synchronization resumed",
  "Remote response received",
  "Waiting for confirmation…",
  "Confirmation received",
] as const;

const PROPAGATE_MESSAGES = [
  "Propagating changes",
  "Propagating changes across services",
  "Propagating updated configuration",
  "Applying configuration changes",
  "Applying remote changes",
  "Refreshing application state",
  "Refreshing configuration state",
  "Refreshing service configuration",
  "Configuration propagated",
  "Updating environment state",
  "Applying configuration",
] as const;

const VERIFY_MESSAGES = [
  "Verifying remote configuration",
  "Verifying remote state…",
  "Checking deployment status",
  "Testing configuration availability",
  "Running final verification…",
  "Running final verification",
  "Running consistency check",
  "Running post-deployment checks",
  "Checking propagation",
  "Final consistency check…",
  "Verifying updated state",
  "Running final checks",
] as const;

const FINALIZE_MESSAGES = [
  "Verification complete",
  "Configuration verified",
  "Update verified",
  "Synchronization complete",
  "Successfully verified",
  "Deployment verified successfully",
  "Configuration synchronized",
] as const;

function buildRandomTimeline(targetMs: number, scenario: Scenario): ScheduledEntry[] {
  const entries: ScheduledEntry[] = [];
  let t = 0;
  let progress = randInt(5, 14);

  const push = (phase: string, message: string, atMs: number, p?: number) => {
    if (p !== undefined) progress = p;
    else progress = organicProgress(progress);
    entries.push({ atMs, phase, message, progress });
    t = atMs;
  };

  push("validation", pick(OPENING_MESSAGES), 0);

  const stagePlan: Array<{
    phase: string;
    pool: readonly string[];
    minMsgs: number;
    maxMsgs: number;
  }> = [
    { phase: "validation", pool: VALIDATION_MESSAGES, minMsgs: 1, maxMsgs: 2 },
    { phase: "prepare", pool: PREPARE_MESSAGES, minMsgs: 1, maxMsgs: 2 },
    { phase: "synchronization", pool: SYNC_MESSAGES, minMsgs: 1, maxMsgs: 3 },
    { phase: "propagation", pool: PROPAGATE_MESSAGES, minMsgs: 1, maxMsgs: 2 },
    { phase: "verification", pool: VERIFY_MESSAGES, minMsgs: 1, maxMsgs: 2 },
    { phase: "finalize", pool: FINALIZE_MESSAGES, minMsgs: 1, maxMsgs: 1 },
  ];

  if (scenario === "normal" || scenario === "slow" || scenario === "very_slow") {
    const insertAt = randInt(2, 3);
    stagePlan.splice(insertAt, 0, {
      phase: "wait",
      pool: WAIT_MESSAGES,
      minMsgs: scenario === "very_slow" ? 2 : 1,
      maxMsgs: scenario === "very_slow" ? 4 : scenario === "slow" ? 3 : 2,
    });
  }

  const budgetEnd = targetMs - randInt(400, 900);
  const waitHeavy = scenario === "slow" || scenario === "very_slow";

  for (const stage of stagePlan) {
    const count = randInt(stage.minMsgs, stage.maxMsgs);
    const messages =
      stage.phase === "wait"
        ? pickMany(stage.pool, count)
        : pickMany(stage.pool, count);

    for (let i = 0; i < messages.length; i++) {
      const gap =
        stage.phase === "wait"
          ? rand(
              waitHeavy ? 1200 : 700,
              waitHeavy ? 4200 : 2800,
            )
          : rand(350, scenario === "fast" ? 1400 : 2800);

      const nextT = Math.min(budgetEnd, t + gap);
      if (nextT <= t && i > 0) break;

      const holdProgress =
        stage.phase === "wait" && Math.random() < 0.65 ? progress : undefined;
      push(stage.phase, messages[i], nextT === t ? t + 100 : nextT, holdProgress);
      t = entries.at(-1)!.atMs;

      if (t >= budgetEnd * 0.88) break;
    }
    if (t >= budgetEnd * 0.88) break;
  }

  const finalAt = Math.min(budgetEnd, t + randInt(300, 1200));
  push("finalize", pick(FINALIZE_MESSAGES), finalAt, 100);

  return entries.sort((a, b) => a.atMs - b.atMs);
}

export class DeployPresentationRunner {
  private readonly events: PresentationEvent[] = [];
  private readonly timeouts: ReturnType<typeof setTimeout>[] = [];
  private startedAt = 0;
  private readonly durationMs: number;
  private readonly timeline: ScheduledEntry[];

  constructor(private readonly onUpdate: (events: PresentationEvent[]) => void) {
    const scenario = pickScenario();
    this.durationMs = pickTargetDurationMs(scenario);
    this.timeline = buildRandomTimeline(this.durationMs, scenario);
  }

  getDurationMs(): number {
    return this.durationMs;
  }

  start(): void {
    this.startedAt = Date.now();
    this.events.length = 0;
    this.onUpdate([]);

    for (const entry of this.timeline) {
      const timeout = setTimeout(() => {
        const event: PresentationEvent = {
          phase: entry.phase,
          message: entry.message,
          at: new Date().toISOString(),
          progress: entry.progress,
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

export function formatPresentationElapsed(
  atIso: string,
  startedAtMs: number,
): string {
  const ms = Math.max(0, Date.parse(atIso) - startedAtMs);
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const frac = Math.floor((ms % 1000) / 100);
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(0).padStart(2, "0")}.${frac}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
