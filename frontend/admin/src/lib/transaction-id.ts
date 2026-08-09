/** Resolve the canonical transaction journey ID from heterogeneous fields. */
export function resolveTransactionId(
  fields: {
    transactionId?: string | null;
    traceId?: string | null;
    sessionId?: string | null;
    clientSessionId?: string | null;
  },
  metadata?: Record<string, unknown>,
): string | null {
  const direct =
    fields.transactionId?.trim() ||
    fields.traceId?.trim() ||
    fields.clientSessionId?.trim() ||
    fields.sessionId?.trim();
  if (direct) return direct;

  if (!metadata) return null;
  for (const key of [
    "transactionId",
    "traceId",
    "clientSessionId",
    "sessionId",
  ]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function shortTransactionId(id: string, head = 12, tail = 6): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
