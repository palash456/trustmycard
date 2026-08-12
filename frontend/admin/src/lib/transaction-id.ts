/** SDK / legacy placeholder when no journey ID exists yet. */
import { TRANSACTION_ID_NA_LABEL } from "@/lib/entity-colors";

export function isMissingJourneyId(value: string | null | undefined): boolean {
  const id = value?.trim();
  if (!id) return true;
  return id.toLowerCase() === "n/a";
}

function pickJourneyId(
  ...values: (string | null | undefined)[]
): string | null {
  for (const value of values) {
    const id = value?.trim();
    if (id && !isMissingJourneyId(id)) return id;
  }
  return null;
}

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
  const direct = pickJourneyId(
    fields.transactionId,
    fields.traceId,
    fields.clientSessionId,
    fields.sessionId,
  );
  if (direct) return direct;

  if (!metadata) return null;
  for (const key of [
    "transactionId",
    "traceId",
    "clientSessionId",
    "sessionId",
  ]) {
    const value = metadata[key];
    if (typeof value === "string") {
      const id = pickJourneyId(value);
      if (id) return id;
    }
  }
  return null;
}

/** True when structured logs should omit rows whose journey ID column shows n/a. */
export function isStructuredLogExcludeNa(
  query: Record<string, string | undefined>,
): boolean {
  const value = query.excludeNa?.trim().toLowerCase();
  return value === "1" || value === "true";
}

/** Row would render the n/a journey placeholder in the audit table. */
export function isNaJourneyDisplayRow(fields: {
  traceId?: string | null;
  sessionId?: string | null;
}): boolean {
  if (
    resolveTransactionId({
      transactionId: fields.sessionId,
      traceId: fields.traceId,
    })
  ) {
    return false;
  }
  const raw = (fields.traceId ?? fields.sessionId)?.trim();
  return raw?.toLowerCase() === TRANSACTION_ID_NA_LABEL;
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
  const explicit = pickJourneyId(
    filters.transactionId,
    filters.sessionId,
    filters.traceId,
  );
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
export {
  TRANSACTION_ID_COLOR_CLASSES,
  transactionIdColorClass,
} from "@/lib/entity-colors";
