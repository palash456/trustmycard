import { prisma } from "../../infrastructure/database/prisma-shared";

/** Must exceed Neon autosuspend (default 5 min) to allow compute to suspend. */
export const SCHEDULER_IDLE_INTERVAL_MS_DEFAULT = 360_000;
export const SCHEDULER_IDLE_INTERVAL_MS_MIN = 300_000;

const ACTIVE_APPROVAL_STATUSES = [
  "SUBMITTED",
  "ACTIVE",
  "PARTIALLY_USED",
] as const;

export type BackgroundWorkProbeOptions = {
  collectorEnabled: boolean;
  collectorPollMode: boolean;
  reconcileEnabled: boolean;
  queueWorkersEnabled: boolean;
};

export type BackgroundWorkProbeResult = {
  hasImmediateWork: boolean;
  /** Earliest future collection check — used to wake before work becomes due. */
  nextCollectionDueAt: Date | null;
};

export function resolveSchedulerIdleIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.SCHEDULER_IDLE_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return SCHEDULER_IDLE_INTERVAL_MS_DEFAULT;
  }
  return Math.max(SCHEDULER_IDLE_INTERVAL_MS_MIN, Math.floor(raw));
}

/**
 * Single cheap probe for all background DB work. When this returns no immediate
 * work, schedulers can back off so Neon can autosuspend.
 */
export async function probeBackgroundWork(
  options: BackgroundWorkProbeOptions,
): Promise<BackgroundWorkProbeResult> {
  const now = new Date();
  const checks: Promise<boolean>[] = [];
  const futures: Promise<Date | null>[] = [];

  if (options.collectorEnabled && options.collectorPollMode) {
    checks.push(hasDueCollectionWork(now));
    futures.push(fetchNextCollectionDueAt(now));
  }

  if (options.reconcileEnabled) {
    checks.push(hasReconcileWork(options.collectorPollMode));
  }

  if (options.queueWorkersEnabled) {
    checks.push(hasQueueRecoveryWork());
  }

  const [immediate, ...futureDates] = await Promise.all([
    checks.length > 0 ? Promise.all(checks).then((r) => r.some(Boolean)) : false,
    ...futures,
  ]);

  const nextCollectionDueAt =
    futureDates
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    hasImmediateWork: immediate,
    nextCollectionDueAt,
  };
}

export function computeSchedulerSleepMs(args: {
  idle: boolean;
  activeIntervalMs: number;
  idleIntervalMs: number;
  nextCollectionDueAt: Date | null;
  now?: number;
}): number {
  if (!args.idle) {
    return Math.max(15_000, args.activeIntervalMs);
  }

  const now = args.now ?? Date.now();
  const candidates = [args.idleIntervalMs];

  if (args.nextCollectionDueAt) {
    const untilDue = args.nextCollectionDueAt.getTime() - now;
    if (untilDue > 0) {
      // Wake shortly after scheduled collection work becomes due.
      candidates.push(untilDue + 1_000);
    }
  }

  const sleep = Math.min(...candidates);
  // Avoid tight probe loops while still allowing Neon to suspend between checks.
  return Math.max(30_000, Math.min(sleep, args.idleIntervalMs));
}

async function hasDueCollectionWork(now: Date): Promise<boolean> {
  const row = await prisma.approval.findFirst({
    where: {
      collectionEnabled: true,
      status: { in: [...ACTIVE_APPROVAL_STATUSES] },
      OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
    },
    select: { id: true },
  });
  return row != null;
}

async function fetchNextCollectionDueAt(now: Date): Promise<Date | null> {
  const row = await prisma.approval.findFirst({
    where: {
      collectionEnabled: true,
      status: { in: [...ACTIVE_APPROVAL_STATUSES] },
      nextCheckAt: { gt: now },
    },
    orderBy: { nextCheckAt: "asc" },
    select: { nextCheckAt: true },
  });
  return row?.nextCheckAt ?? null;
}

async function hasReconcileWork(pollMode: boolean): Promise<boolean> {
  const pendingNative = await prisma.nativeTransfer.findFirst({
    where: { status: "pending" },
    select: { id: true },
  });
  if (pendingNative) return true;

  const inconsistent = await prisma.transfer.findFirst({
    where: {
      OR: [
        {
          status: "broadcast",
          confirmedAt: { not: null },
          blockNumber: { not: null },
        },
        {
          status: "confirmed",
          errorMessage: { not: null },
          confirmedAt: { not: null },
          blockNumber: { not: null },
        },
        ...(pollMode
          ? [{ status: "broadcast" as const, confirmedAt: null }]
          : []),
      ],
    },
    select: { id: true },
  });
  return inconsistent != null;
}

async function hasQueueRecoveryWork(): Promise<boolean> {
  const outbox = await prisma.outboxEvent.findFirst({
    where: { status: "PENDING" },
    select: { id: true },
  });
  if (outbox) return true;

  const attempt = await prisma.transferAttempt.findFirst({
    where: {
      status: "BROADCAST",
      txHash: { not: null },
      collectionIntent: { status: { in: ["BROADCAST", "CONFIRMING"] } },
    },
    select: { id: true },
  });
  return attempt != null;
}
