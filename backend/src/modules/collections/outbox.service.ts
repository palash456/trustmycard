import { Injectable } from "@nestjs/common";
import { OutboxEventStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { PlatformConfigService } from "../../config/platform-config.service";

export const COLLECTION_EVENT = {
  QUEUED: "CollectionQueued",
  STARTED: "CollectionStarted",
  BROADCASTED: "TransferBroadcasted",
  CONFIRMED: "TransferConfirmed",
  SETTLED: "CollectionSettled",
  FAILED: "CollectionFailed",
  RETRY_STARTED: "RetryStarted",
  RECOVERY_STARTED: "RecoveryStarted",
  RECOVERY_COMPLETED: "RecoveryCompleted",
} as const;

export type CollectionEventType = (typeof COLLECTION_EVENT)[keyof typeof COLLECTION_EVENT];

@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformConfig: PlatformConfigService
  ) {}

  async record(
    tx: Prisma.TransactionClient,
    args: {
      aggregateType: string;
      aggregateId: string;
      collectionIntentId?: string;
      eventType: CollectionEventType;
      payload: Prisma.InputJsonValue;
    }
  ) {
    return tx.outboxEvent.create({
      data: {
        id: randomUUID(),
        aggregateType: args.aggregateType,
        aggregateId: args.aggregateId,
        collectionIntentId: args.collectionIntentId,
        eventType: args.eventType,
        payload: args.payload,
      },
    });
  }

  async claimPending(owner: string, limit: number) {
    const now = new Date();
    const lockUntil = new Date(
      now.getTime() + this.platformConfig.getOutbox().claimLockMs
    );
    return this.prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "OutboxEvent"
        WHERE "status" IN (${OutboxEventStatus.PENDING}, ${OutboxEventStatus.FAILED}, ${OutboxEventStatus.PUBLISHING})
          AND ("lockUntil" IS NULL OR "lockUntil" <= ${now})
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `;
      if (events.length === 0) return [];
      const ids = events.map((event) => event.id);
      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: {
          status: OutboxEventStatus.PUBLISHING,
          lockOwner: owner,
          lockToken: randomUUID(),
          lockUntil,
          publishAttempts: { increment: 1 },
        },
      });
      return tx.outboxEvent.findMany({ where: { id: { in: ids } } });
    });
  }

  async markPublished(id: string, owner: string): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.PUBLISHING, lockOwner: owner },
      data: {
        status: OutboxEventStatus.PUBLISHED,
        publishedAt: new Date(),
        lockOwner: null,
        lockToken: null,
        lockUntil: null,
        lastError: null,
      },
    });
  }

  async markFailed(id: string, owner: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.PUBLISHING, lockOwner: owner },
      data: {
        status: OutboxEventStatus.FAILED,
        lockOwner: null,
        lockToken: null,
        lockUntil: null,
        lastError: error.slice(0, 2_000),
      },
    });
  }
}
