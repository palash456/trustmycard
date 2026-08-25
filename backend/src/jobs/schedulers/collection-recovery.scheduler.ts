import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ConfigService } from "../../config/config.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { OutboxPublisherService } from "../workers/outbox-publisher.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { CollectionQueueService } from "../queues/collection-queue.service";
import { PlatformConfigService } from "../../config/platform-config.service";

/**
 * Recovery-only scheduler. Normal collection is dispatched by the outbox and
 * BullMQ workers; this timer only replays durable, unacknowledged outbox work.
 */
@Injectable()
export class CollectionRecoveryScheduler {
  private running = false;
  private readonly id = `recovery:${process.pid}:${randomUUID()}`;

  constructor(
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly publisher: OutboxPublisherService,
    private readonly logger: StructuredLoggerService,
    private readonly prisma: PrismaService,
    private readonly queues: CollectionQueueService,
  ) {}

  isEffectivelyEnabled(): boolean {
    return (
      this.config.getCollectionWorkerConfig().mode !== "poll" &&
      this.platformConfig.getCollection().workersEnabled
    );
  }

  async recover(): Promise<void> {
    if (this.running || !this.isEffectivelyEnabled()) return;
    this.running = true;
    try {
      const republished = await this.publisher.publish();
      const pendingAttempts = await this.prisma.transferAttempt.findMany({
        where: {
          status: { in: ["BROADCAST"] },
          txHash: { not: null },
          collectionIntent: { status: { in: ["BROADCAST", "CONFIRMING"] } },
        },
        take: this.platformConfig.getCollection().recoveryBatchSize,
        include: { collectionIntent: { select: { network: true } } },
      });
      await Promise.all(
        pendingAttempts.map((attempt) =>
          this.queues.enqueueConfirmation({
            intentId: attempt.collectionIntentId,
            attemptId: attempt.id,
            txHash: attempt.txHash!,
            network: attempt.collectionIntent.network,
          }),
        ),
      );
      this.logger.emit({
        level: "info",
        module: "collection-recovery",
        operation: "outbox_replay",
        status: "success",
        message: "Collection recovery sweep completed",
        context: {
          owner: this.id,
          republished,
          confirmationRequeued: pendingAttempts.length,
        },
      });
    } finally {
      this.running = false;
    }
  }
}
