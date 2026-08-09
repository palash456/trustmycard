export const COLLECTION_EXECUTION_QUEUE = "collection-execution";
export const COLLECTION_CONFIRMATION_QUEUE = "collection-confirmation";
export const COLLECTION_WEBHOOK_QUEUE = "collection-webhook";
export const COLLECTION_DLQ_QUEUE = "collection-dlq";

export type CollectionExecutionJob = {
  intentId: string;
  outboxEventId: string;
  traceId?: string;
};

export type CollectionConfirmationJob = {
  intentId: string;
  attemptId: string;
  txHash: string;
  network: string;
  traceId?: string;
};

export type CollectionWebhookJob = {
  eventId: string;
  intentId: string;
  traceId?: string;
};

export type CollectionDlqJob = {
  sourceQueue: string;
  sourceJobId: string;
  payload: Record<string, unknown>;
  error: string;
};
