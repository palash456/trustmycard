export type AuditTab = "admin" | "structured" | "timelines";

export type LogLinkParams = {
  tab?: AuditTab;
  walletAddress?: string;
  sessionId?: string;
  traceId?: string;
  transactionId?: string;
  correlationId?: string;
  txHash?: string;
  errorCode?: string;
  module?: string;
  entityType?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
};

function build(path: string, params: LogLinkParams): string {
  const q = new URLSearchParams();
  if (params.tab) q.set("tab", params.tab);
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab" || !value?.trim()) continue;
    q.set(key, value.trim());
  }
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

export function auditLink(params: LogLinkParams = {}): string {
  return build("/audit", params);
}

export function auditStructuredLink(
  params: Omit<LogLinkParams, "tab"> = {}
): string {
  return auditLink({ ...params, tab: "structured" });
}

export function auditTimelineLink(
  params: Omit<LogLinkParams, "tab"> = {}
): string {
  return auditLink({ ...params, tab: "timelines" });
}

export function auditAdminLink(params: Omit<LogLinkParams, "tab"> = {}): string {
  return auditLink({ ...params, tab: "admin" });
}

export function transactionDetailLink(
  transactionId: string,
  options?: { token?: string | null }
): string {
  const base = `/transactions/${encodeURIComponent(transactionId)}`;
  const token = options?.token?.trim();
  if (!token || token.includes(",")) return base;
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function transactionLogsLink(transactionId: string): string {
  return auditStructuredLink({ traceId: transactionId, transactionId });
}

export function activityLink(params: {
  address?: string;
  network?: string;
  tab?: string;
  type?: string;
  module?: string;
  search?: string;
  sessionId?: string;
  traceId?: string;
  transactionId?: string;
} = {}): string {
  const q = new URLSearchParams();
  if (params.tab) q.set("tab", params.tab);
  if (params.address) q.set("address", params.address);
  if (params.network) q.set("network", params.network);
  if (params.type) q.set("type", params.type);
  if (params.module) q.set("type", params.module);
  if (params.traceId) q.set("traceId", params.traceId);
  if (params.transactionId) q.set("transactionId", params.transactionId);
  if (params.search) q.set("search", params.search);
  if (params.sessionId) q.set("search", params.sessionId);
  const qs = q.toString();
  return qs ? `/activity?${qs}` : "/activity";
}

export function activityDetailLink(
  source: string,
  id: string,
  params: { sessionId?: string } = {}
): string {
  const q = new URLSearchParams({ source });
  if (params.sessionId) q.set("sessionId", params.sessionId);
  return `/activity/${encodeURIComponent(id)}?${q.toString()}`;
}

/** @deprecated Prefer activityLink — kept for audit deep-links */

export function timelineDetailLink(sessionId: string): string {
  return `/audit/timeline/${encodeURIComponent(sessionId)}`;
}
