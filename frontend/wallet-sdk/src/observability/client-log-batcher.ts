import type { LogEvent } from "@trustmycard/shared/observability";
import { correlationHeaders } from "../core/transaction-context";

const FLUSH_MS = 400;
const MAX_BATCH = 40;

let pending: LogEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;

function clientLogsUrl(): string {
  const backend =
    typeof process !== "undefined" && process.env.BACKEND_URL
      ? process.env.BACKEND_URL
      : "";
  return backend
    ? `${backend.replace(/\/$/, "")}/v1/client-logs`
    : "/api/client-logs";
}

async function postBatch(events: LogEvent[]): Promise<void> {
  if (events.length === 0) return;
  const transactionId =
    events[0]?.transactionId ??
    events[0]?.traceId ??
    events[0]?.correlationId ??
    events[0]?.sessionId;
  try {
    await fetch(clientLogsUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...correlationHeaders(transactionId),
      },
      body: JSON.stringify({ type: "log", events }),
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    /* soft-fail */
  }
}

async function flushAll(): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    while (pending.length > 0) {
      const batch = pending.slice(0, MAX_BATCH);
      pending = pending.slice(MAX_BATCH);
      await postBatch(batch);
    }
  } finally {
    inflight = false;
    if (pending.length > 0) {
      scheduleFlush();
    }
  }
}

function scheduleFlush(delayMs = FLUSH_MS): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAll();
  }, delayMs);
}

/** Queue a client log for batched delivery (reduces 429s during connect flows). */
export function queueClientLog(event: LogEvent): void {
  pending.push(event);
  const isUrgent =
    event.level === "error" ||
    event.level === "fatal" ||
    pending.length >= MAX_BATCH;
  scheduleFlush(isUrgent ? 0 : FLUSH_MS);
}
