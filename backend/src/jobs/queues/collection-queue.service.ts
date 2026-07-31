import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue, type JobsOptions } from "bullmq";
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

const redisUrl = (): string => {
  const value = (process.env.REDIS_URL ?? "").trim();
  return value || "redis://127.0.0.1:6379";
};

const jobOptions: JobsOptions = {
  attempts: Math.max(1, Number(process.env.COLLECTION_QUEUE_ATTEMPTS ?? 8)),
  backoff: {
    type: "exponential",
    delay: Math.max(1_000, Number(process.env.COLLECTION_QUEUE_BACKOFF_MS ?? 5_000)),
  },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: false,
};

@Injectable()
export class CollectionQueueService implements OnModuleDestroy {
  readonly connection = { url: redisUrl() };
  readonly execution = new Queue<CollectionExecutionJob>(COLLECTION_EXECUTION_QUEUE, {
    connection: this.connection,
    defaultJobOptions: jobOptions,
  });
  readonly confirmation = new Queue<CollectionConfirmationJob>(COLLECTION_CONFIRMATION_QUEUE, {
    connection: this.connection,
    defaultJobOptions: jobOptions,
  });
  readonly webhook = new Queue<CollectionWebhookJob>(COLLECTION_WEBHOOK_QUEUE, {
    connection: this.connection,
    defaultJobOptions: jobOptions,
  });
  readonly dlq = new Queue<CollectionDlqJob>(COLLECTION_DLQ_QUEUE, {
    connection: this.connection,
    defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
  });

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
    const jobs = await this.dlq.getJobs(["waiting", "active", "failed"], 0, 200, false);
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
