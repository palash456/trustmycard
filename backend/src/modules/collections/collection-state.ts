import { BadRequestException } from "@nestjs/common";
import { CollectionIntentStatus, TransferAttemptStatus } from "@prisma/client";

const intentTransitions: Record<
  CollectionIntentStatus,
  readonly CollectionIntentStatus[]
> = {
  CREATED: [CollectionIntentStatus.QUEUED, CollectionIntentStatus.CANCELLED],
  QUEUED: [
    CollectionIntentStatus.EXECUTING,
    CollectionIntentStatus.CANCELLED,
    CollectionIntentStatus.BLOCKED,
  ],
  EXECUTING: [
    CollectionIntentStatus.BROADCAST,
    CollectionIntentStatus.FAILED,
    CollectionIntentStatus.BLOCKED,
  ],
  BROADCAST: [
    CollectionIntentStatus.CONFIRMING,
    CollectionIntentStatus.SETTLED,
    CollectionIntentStatus.FAILED,
  ],
  CONFIRMING: [
    CollectionIntentStatus.SETTLED,
    CollectionIntentStatus.FAILED,
    CollectionIntentStatus.BROADCAST,
  ],
  SETTLED: [],
  FAILED: [CollectionIntentStatus.QUEUED, CollectionIntentStatus.CANCELLED],
  BLOCKED: [CollectionIntentStatus.QUEUED, CollectionIntentStatus.CANCELLED],
  CANCELLED: [],
};

export function assertIntentTransition(
  from: CollectionIntentStatus,
  to: CollectionIntentStatus,
): void {
  if (from === to || intentTransitions[from].includes(to)) return;
  throw new BadRequestException(
    `Invalid collection intent transition ${from} -> ${to}`,
  );
}

export function isFinalAttempt(status: TransferAttemptStatus): boolean {
  return (
    status === TransferAttemptStatus.CONFIRMED ||
    status === TransferAttemptStatus.FAILED
  );
}
