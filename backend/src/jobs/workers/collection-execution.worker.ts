import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { ConfigService } from "../../config/config.service";
import { WalletService } from "../../modules/wallet/wallet.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { incrementCounter, recordTiming } from "@trustmycard/shared/observability";
import {
  COLLECTION_EXECUTION_QUEUE,
  type CollectionExecutionJob,
} from "../queues/collection-queue.types";
import { CollectionQueueService } from "../queues/collection-queue.service";

@Injectable()
export class CollectionExecutionWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<CollectionExecutionJob> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly queues: CollectionQueueService,
    private readonly wallet: WalletService,
    private readonly logger: StructuredLoggerService
  ) {}

  onModuleInit(): void {
    const config = this.config.getCollectionWorkerConfig();
    if (config.mode !== "queue" || !this.queues.workersEnabled()) return;
    this.worker = new Worker(
      COLLECTION_EXECUTION_QUEUE,
      async (job) => {
        const started = Date.now();
        if (job.data.traceId) {
          this.logger.emit({
            level: "info",
            module: "collector",
            operation: "collection_execution",
            stage: "EXECUTING",
            status: "in_progress",
            message: "Collection execution started",
            traceId: job.data.traceId,
            transactionId: job.data.traceId,
            sessionId: job.data.traceId,
            correlationId: job.data.traceId,
            context: { intentId: job.data.intentId },
          });
        }
        const broadcast = await this.wallet.broadcastCollectionIntent(job.data.intentId);
        incrementCounter("collection.execution.broadcast.total");
        recordTiming("collection.execution.broadcast_ms", Date.now() - started, {});
        await this.queues.enqueueConfirmation({
          intentId: job.data.intentId,
          attemptId: broadcast.attemptId,
          txHash: broadcast.txHash,
          network: "",
          traceId: job.data.traceId,
        });
      },
      { connection: this.queues.connection, concurrency: config.queueConcurrency }
    );
    this.worker.on("failed", (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      void this.queues.enqueueDeadLetter({
        sourceQueue: COLLECTION_EXECUTION_QUEUE,
        sourceJobId: String(job.id),
        payload: { intentId: job.data.intentId, outboxEventId: job.data.outboxEventId },
        error: error.message,
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
