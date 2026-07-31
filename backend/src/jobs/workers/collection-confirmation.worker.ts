import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { ConfigService } from "../../config/config.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import { WalletService } from "../../modules/wallet/wallet.service";
import { incrementCounter, recordTiming } from "@trustmycard/shared/observability";
import {
  COLLECTION_CONFIRMATION_QUEUE,
  type CollectionConfirmationJob,
} from "../queues/collection-queue.types";
import { CollectionQueueService } from "../queues/collection-queue.service";

@Injectable()
export class CollectionConfirmationWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<CollectionConfirmationJob> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly queues: CollectionQueueService,
    private readonly wallet: WalletService
  ) {}

  onModuleInit(): void {
    const config = this.config.getCollectionWorkerConfig();
    if (config.mode !== "queue" || !this.queues.workersEnabled()) return;
    this.worker = new Worker(
      COLLECTION_CONFIRMATION_QUEUE,
      async (job) => {
        const started = Date.now();
        const result = await this.wallet.confirmCollectionAttempt(job.data.attemptId);
        recordTiming("collection.confirmation.check_ms", Date.now() - started, {});
        if (!result.finalized) {
          incrementCounter("collection.confirmation.pending.total");
          await this.queues.enqueueConfirmation(
            job.data,
            result.retryAfterMs ??
              this.platformConfig.getTransfer().confirmationRetryDelayMs
          );
        } else {
          incrementCounter("collection.confirmation.finalized.total");
        }
      },
      { connection: this.queues.connection, concurrency: config.confirmationConcurrency }
    );
    this.worker.on("failed", (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      void this.queues.enqueueDeadLetter({
        sourceQueue: COLLECTION_CONFIRMATION_QUEUE,
        sourceJobId: String(job.id),
        payload: {
          intentId: job.data.intentId,
          attemptId: job.data.attemptId,
          txHash: job.data.txHash,
          network: job.data.network,
        },
        error: error.message,
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
