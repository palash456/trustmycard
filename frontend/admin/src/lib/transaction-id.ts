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

/** True when the query looks like a journey / flow-* transaction ID. */
export function looksLikeFlowTransactionId(value: string): boolean {
  return /^flow-/i.test(value.trim());
}

/** Resolve transaction ID from dedicated params or flow-* search text. */
export function resolveStructuredLogTransactionId(
  filters: Record<string, string | undefined>,
): string | undefined {
  const explicit =
    filters.transactionId?.trim() ||
    filters.sessionId?.trim() ||
    filters.traceId?.trim();
  if (explicit) return explicit;
  const search = filters.search?.trim();
  if (search && looksLikeFlowTransactionId(search)) return search;
  return undefined;
}

/** Search text for API — flow-* IDs are routed via transactionId fields instead. */
export function resolveStructuredLogSearchText(
  filters: Record<string, string | undefined>,
): string | undefined {
  const search = filters.search?.trim();
  if (!search) return undefined;
  const transactionId = resolveStructuredLogTransactionId(filters);
  if (transactionId && search === transactionId) return undefined;
  return search;
}

/** Stable accent colors so the same transaction ID always renders the same shade. */
export const TRANSACTION_ID_COLOR_CLASSES = [
  "text-emerald-600 dark:text-emerald-400",
  "text-amber-600 dark:text-amber-400",
  "text-violet-600 dark:text-violet-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-orange-600 dark:text-orange-400",
] as const;

export function transactionIdColorClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TRANSACTION_ID_COLOR_CLASSES[hash % TRANSACTION_ID_COLOR_CLASSES.length];
}
