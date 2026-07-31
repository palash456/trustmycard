import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createHmac } from "crypto";
import { Worker } from "bullmq";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  COLLECTION_WEBHOOK_QUEUE,
  type CollectionWebhookJob,
} from "../queues/collection-queue.types";
import { CollectionQueueService } from "../queues/collection-queue.service";

@Injectable()
export class MerchantWebhookWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<CollectionWebhookJob> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly queues: CollectionQueueService,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit(): void {
    if (
      this.config.getCollectionWorkerConfig().mode !== "queue" ||
      process.env.COLLECTION_WORKERS_ENABLED !== "true"
    ) {
      return;
    }
    this.worker = new Worker(
      COLLECTION_WEBHOOK_QUEUE,
      async (job) => {
        const delivery = await this.prisma.merchantWebhookDelivery.findFirst({
          where: { eventId: job.data.eventId, collectionIntentId: job.data.intentId },
        });
        if (!delivery || delivery.status === "DELIVERED") return;
        const body = JSON.stringify({
          id: delivery.eventId,
          type: delivery.eventType,
          collectionIntentId: delivery.collectionIntentId,
          data: delivery.payload,
        });
        const secret = process.env.MERCHANT_WEBHOOK_SECRET ?? "";
        const response = await fetch(delivery.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-trustmycard-event-id": delivery.eventId,
            ...(secret
              ? {
                  "x-trustmycard-signature": createHmac("sha256", secret)
                    .update(body)
                    .digest("hex"),
                }
              : {}),
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Merchant webhook responded ${response.status}`);
        await this.prisma.merchantWebhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "DELIVERED", deliveredAt: new Date(), attempts: { increment: 1 }, lastError: null },
        });
      },
      { connection: this.queues.connection, concurrency: 8 }
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
