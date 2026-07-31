import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ConfigService } from "../../config/config.service";
import { getErrorMessage } from "@trustmycard/shared/observability";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { COLLECTION_EVENT, OutboxService } from "../../modules/collections/outbox.service";
import { CollectionQueueService } from "../queues/collection-queue.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly owner = `outbox:${process.pid}:${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly queues: CollectionQueueService,
    private readonly logger: StructuredLoggerService,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit(): void {
    const cfg = this.config.getCollectionWorkerConfig();
    if (cfg.mode === "poll" || process.env.COLLECTION_WORKERS_ENABLED !== "true") return;
    this.timer = setInterval(() => void this.publish(), cfg.outboxPublishIntervalMs);
    this.timer.unref();
    void this.publish();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
  }

  async publish(): Promise<number> {
    if (this.running || this.config.getCollectionWorkerConfig().mode === "poll") return 0;
    this.running = true;
    let published = 0;
    try {
      const events = await this.outbox.claimPending(this.owner, 100);
      for (const event of events) {
        try {
          if (event.eventType === COLLECTION_EVENT.QUEUED && event.collectionIntentId) {
            await this.queues.enqueueExecution({
              intentId: event.collectionIntentId,
              outboxEventId: event.id,
            });
          }
          if (
            event.eventType !== COLLECTION_EVENT.QUEUED &&
            event.collectionIntentId &&
            process.env.MERCHANT_WEBHOOK_URL
          ) {
            const delivery = await this.prisma.merchantWebhookDelivery.upsert({
              where: {
                eventId_endpoint: {
                  eventId: event.id,
                  endpoint: process.env.MERCHANT_WEBHOOK_URL,
                },
              },
              create: {
                collectionIntentId: event.collectionIntentId,
                eventId: event.id,
                eventType: event.eventType,
                endpoint: process.env.MERCHANT_WEBHOOK_URL,
                payload: event.payload === null
                  ? Prisma.JsonNull
                  : event.payload as Prisma.InputJsonValue,
              },
              update: {},
            });
            await this.queues.enqueueWebhook({
              eventId: delivery.eventId,
              intentId: delivery.collectionIntentId,
            });
          }
          await this.outbox.markPublished(event.id, this.owner);
          published += 1;
        } catch (error) {
          await this.outbox.markFailed(event.id, this.owner, getErrorMessage(error));
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
