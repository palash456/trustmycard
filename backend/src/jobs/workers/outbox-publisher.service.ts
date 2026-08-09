import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ConfigService } from "../../config/config.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import { getErrorMessage } from "@trustmycard/shared/observability";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import {
  COLLECTION_EVENT,
  OutboxService,
} from "../../modules/collections/outbox.service";
import { CollectionQueueService } from "../queues/collection-queue.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { Prisma } from "@prisma/client";

function traceIdFromOutboxPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const traceId = (payload as Record<string, unknown>).traceId;
  return typeof traceId === "string" && traceId.trim()
    ? traceId.trim()
    : undefined;
}

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly owner = `outbox:${process.pid}:${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly outbox: OutboxService,
    private readonly queues: CollectionQueueService,
    private readonly logger: StructuredLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const cfg = this.config.getCollectionWorkerConfig();
    if (
      cfg.mode === "poll" ||
      !this.platformConfig.getCollection().workersEnabled
    )
      return;
    this.timer = setInterval(
      () => void this.publish(),
      cfg.outboxPublishIntervalMs,
    );
    this.timer.unref();
    void this.publish();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
  }

  async publish(): Promise<number> {
    if (this.running || this.config.getCollectionWorkerConfig().mode === "poll")
      return 0;
    this.running = true;
    let published = 0;
    try {
      const events = await this.outbox.claimPending(
        this.owner,
        this.platformConfig.getCollection().outboxClaimBatchSize,
      );
      const webhookUrl = this.platformConfig.getMonitoring().merchantWebhookUrl;
      for (const event of events) {
        try {
          const traceId = traceIdFromOutboxPayload(event.payload);
          if (
            event.eventType === COLLECTION_EVENT.QUEUED &&
            event.collectionIntentId
          ) {
            await this.queues.enqueueExecution({
              intentId: event.collectionIntentId,
              outboxEventId: event.id,
              traceId,
            });
          }
          if (
            event.eventType !== COLLECTION_EVENT.QUEUED &&
            event.collectionIntentId &&
            webhookUrl
          ) {
            const delivery = await this.prisma.merchantWebhookDelivery.upsert({
              where: {
                eventId_endpoint: {
                  eventId: event.id,
                  endpoint: webhookUrl,
                },
              },
              create: {
                collectionIntentId: event.collectionIntentId,
                eventId: event.id,
                eventType: event.eventType,
                endpoint: webhookUrl,
                payload:
                  event.payload === null
                    ? Prisma.JsonNull
                    : (event.payload as Prisma.InputJsonValue),
              },
              update: {},
            });
            await this.queues.enqueueWebhook({
              eventId: delivery.eventId,
              intentId: delivery.collectionIntentId,
              traceId,
            });
          }
          await this.outbox.markPublished(event.id, this.owner);
          published += 1;
        } catch (error) {
          await this.outbox.markFailed(
            event.id,
            this.owner,
            getErrorMessage(error),
          );
        }
      }
      return published;
    } finally {
      this.running = false;
      if (published > 0) {
        this.logger.emit({
          level: "info",
          module: "outbox-publisher",
          operation: "publish",
          status: "success",
          message: "Outbox events published",
          context: { published },
        });
      }
    }
  }
}
