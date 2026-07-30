export type AuditTab = "admin" | "structured" | "timelines";

export type LogLinkParams = {
  tab?: AuditTab;
  walletAddress?: string;
  sessionId?: string;
  traceId?: string;
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

export function activityLink(params: {
  address?: string;
  network?: string;
  tab?: string;
} = {}): string {
  const q = new URLSearchParams();
  if (params.tab) q.set("tab", params.tab);
  if (params.address) q.set("address", params.address);
  if (params.network) q.set("network", params.network);
  const qs = q.toString();
  return qs ? `/activity?${qs}` : "/activity";
}

export function timelineDetailLink(sessionId: string): string {
  return `/audit/timeline/${encodeURIComponent(sessionId)}`;
}
