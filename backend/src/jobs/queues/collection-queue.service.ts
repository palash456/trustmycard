import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue, type JobsOptions } from "bullmq";
import { ConfigService } from "../../config/config.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import {
  COLLECTION_CONFIRMATION_QUEUE,
  COLLECTION_DLQ_QUEUE,
  COLLECTION_EXECUTION_QUEUE,
  COLLECTION_WEBHOOK_QUEUE,
  type CollectionConfirmationJob,
  type CollectionDlqJob,
  type CollectionExecutionJob,
  type CollectionWebhookJob,
} from "./collection-queue.types";

/** Infrastructure-only — not platform business config. */
function redisUrl(): string {
  const value = (process.env.REDIS_URL ?? "").trim();
  if (value) return value;

  const tmcEnv = (process.env.TMC_ENV ?? "development").trim();
  if (tmcEnv === "production" || tmcEnv === "production-preview") {
    throw new Error(
      "REDIS_URL is required in production (set Upstash rediss://... on Render tmc-backend)"
    );
  }

  return "redis://127.0.0.1:6379";
}

@Injectable()
export class CollectionQueueService implements OnModuleDestroy {
  readonly connection = { url: redisUrl() };
  readonly execution: Queue<CollectionExecutionJob>;
  readonly confirmation: Queue<CollectionConfirmationJob>;
  readonly webhook: Queue<CollectionWebhookJob>;
  readonly dlq: Queue<CollectionDlqJob>;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService
  ) {
    const worker = this.configService.getCollectionWorkerConfig();
    const queueCfg = this.platformConfig.getQueue();
    const jobOptions: JobsOptions = {
      attempts: worker.attempts,
      backoff: { type: "exponential", delay: worker.backoffMs },
      removeOnComplete: {
        age: queueCfg.completeRetentionSec,
        count: queueCfg.completeMaxCount,
      },
      removeOnFail: false,
    };
    this.execution = new Queue(COLLECTION_EXECUTION_QUEUE, {
      connection: this.connection,
      defaultJobOptions: jobOptions,
    });
    this.confirmation = new Queue(COLLECTION_CONFIRMATION_QUEUE, {
      connection: this.connection,
      defaultJobOptions: jobOptions,
    });
    this.webhook = new Queue(COLLECTION_WEBHOOK_QUEUE, {
      connection: this.connection,
      defaultJobOptions: jobOptions,
    });
    this.dlq = new Queue(COLLECTION_DLQ_QUEUE, {
      connection: this.connection,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });
  }

  workersEnabled(): boolean {
    return this.platformConfig.getCollection().workersEnabled;
  }

  async enqueueExecution(job: CollectionExecutionJob): Promise<void> {
    await this.execution.add("execute", job, {
      jobId: `outbox:${job.outboxEventId}`,
      priority: 1,
    });
  }

  async enqueueConfirmation(job: CollectionConfirmationJob, delay = 0): Promise<void> {
    await this.confirmation.add("confirm", job, {
      jobId: `confirm:${job.attemptId}:${delay}`,
      delay,
      priority: 2,
    });
  }

  async enqueueWebhook(job: CollectionWebhookJob): Promise<void> {
    await this.webhook.add("deliver", job, {
      jobId: `webhook:${job.eventId}`,
      priority: 5,
    });
  }

  async enqueueDeadLetter(job: CollectionDlqJob): Promise<void> {
    await this.dlq.add("dead-letter", job, {
      jobId: `dlq:${job.sourceQueue}:${job.sourceJobId}`,
    });
  }

  async stats() {
    const [execution, confirmation, webhook, dlq] = await Promise.all([
      this.execution.getJobCounts("waiting", "active", "delayed", "failed"),
      this.confirmation.getJobCounts("waiting", "active", "delayed", "failed"),
      this.webhook.getJobCounts("waiting", "active", "delayed", "failed"),
      this.dlq.getJobCounts("waiting", "active", "delayed", "failed"),
    ]);
    return { execution, confirmation, webhook, dlq };
  }

  async listDeadLetters() {
    const jobs = await this.dlq.getJobs(
      ["waiting", "active", "failed"],
      0,
      this.platformConfig.getQueue().dlqListLimit,
      false
    );
    return jobs.map((job) => ({
      id: job.id,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
    }));
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.execution.close(), this.confirmation.close(), this.webhook.close(), this.dlq.close()]);
  }
}
