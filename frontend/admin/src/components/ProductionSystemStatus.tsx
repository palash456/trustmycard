"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { useAdminDataMode } from "@/components/useAdminDataMode";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ServiceProbeResult = {
  ok: boolean;
  url: string;
  endpoint: string;
  httpStatus?: number;
  statusText?: string;
  responseTimeMs?: number;
  error?: string;
  checkedAt: string;
};

type WebsiteHealthResult = {
  url: string;
  ok: boolean;
  httpStatus?: number;
  statusText?: string;
  responseTimeMs?: number;
  error?: string;
  checkedAt: string;
};

type ProductionSystemHealth = {
  checkedAt: string;
  website: WebsiteHealthResult;
  backend: ServiceProbeResult;
  api: ServiceProbeResult;
};

type CheckState = "checking" | "healthy" | "degraded" | "failed" | "unknown";

type ChipMeta = {
  label: string;
  state: CheckState;
  className: string;
  icon: typeof CheckCircle2;
};

const STATE_STYLES: Record<CheckState, string> = {
  checking:
    "border-border bg-muted/60 text-muted-foreground [&_svg]:animate-spin",
  healthy:
    "border-emerald-700/30 bg-emerald-700/15 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-600/15 dark:text-emerald-400",
  degraded:
    "border-amber-800/30 bg-amber-700/15 text-amber-950 dark:border-amber-500/20 dark:bg-amber-600/15 dark:text-amber-400",
  failed:
    "border-destructive/30 bg-destructive/10 text-destructive",
  unknown:
    "border-border bg-muted/50 text-muted-foreground",
};

const STATE_ICONS: Record<CheckState, typeof CheckCircle2> = {
  checking: Loader2,
  healthy: CheckCircle2,
  degraded: AlertCircle,
  failed: WifiOff,
  unknown: AlertCircle,
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "—";
  }
}

function formatResponseTime(ms?: number): string {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function resolveWebsiteChip(
  website: WebsiteHealthResult | null,
  checking: boolean,
  localScope: boolean,
): ChipMeta {
  if (checking || !website) {
    return {
      label: "Checking…",
      state: "checking",
      className: STATE_STYLES.checking,
      icon: STATE_ICONS.checking,
    };
  }
  if (!website.url) {
    return {
      label: "Unknown",
      state: "unknown",
      className: STATE_STYLES.unknown,
      icon: STATE_ICONS.unknown,
    };
  }
  if (website.ok) {
    return {
      label: localScope ? "Website" : "Live",
      state: "healthy",
      className: STATE_STYLES.healthy,
      icon: STATE_ICONS.healthy,
    };
  }
  return {
    label: "Offline",
    state: "failed",
    className: STATE_STYLES.failed,
    icon: STATE_ICONS.failed,
  };
}

function resolveBackendChip(
  backend: ServiceProbeResult | null,
  checking: boolean,
): ChipMeta {
  if (checking || !backend) {
    return {
      label: "Checking…",
      state: "checking",
      className: STATE_STYLES.checking,
      icon: STATE_ICONS.checking,
    };
  }
  if (!backend.url) {
    return {
      label: "Unknown",
      state: "unknown",
      className: STATE_STYLES.unknown,
      icon: STATE_ICONS.unknown,
    };
  }
  if (backend.ok) {
    return {
      label: "Backend",
      state: "healthy",
      className: STATE_STYLES.healthy,
      icon: STATE_ICONS.healthy,
    };
  }
  return {
    label: "Unhealthy",
    state: "failed",
    className: STATE_STYLES.failed,
    icon: STATE_ICONS.failed,
  };
}

function resolveApiChip(
  api: ServiceProbeResult | null,
  checking: boolean,
): ChipMeta {
  if (checking || !api) {
    return {
      label: "Checking…",
      state: "checking",
      className: STATE_STYLES.checking,
      icon: STATE_ICONS.checking,
    };
  }
  if (!api.endpoint) {
    return {
      label: "Unknown",
      state: "unknown",
      className: STATE_STYLES.unknown,
      icon: STATE_ICONS.unknown,
    };
  }
  if (api.ok && api.httpStatus) {
    return {
      label: `API ${api.httpStatus}`,
      state: "healthy",
      className: STATE_STYLES.healthy,
      icon: STATE_ICONS.healthy,
    };
  }
  if (api.httpStatus) {
    return {
      label: `API ${api.httpStatus}`,
      state: "failed",
      className: STATE_STYLES.failed,
      icon: STATE_ICONS.failed,
    };
  }
  return {
    label: "API down",
    state: "failed",
    className: STATE_STYLES.failed,
    icon: STATE_ICONS.failed,
  };
}

function aggregateState(
  website: ChipMeta,
  backend: ChipMeta,
  api: ChipMeta,
): CheckState {
  const states = [website.state, backend.state, api.state];
  if (states.includes("checking")) return "checking";
  if (states.includes("failed")) return "failed";
  if (states.includes("degraded") || states.includes("unknown")) return "degraded";
  return "healthy";
}

function StatusChip({
  meta,
  className,
}: {
  meta: ChipMeta;
  className?: string;
}) {
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-4xl border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" />
      {meta.label}
    </span>
  );
}

function DetailRow({
  label,
  ok,
  url,
  statusLine,
  subline,
  error,
}: {
  label: string;
  ok: boolean;
  url?: string;
  statusLine?: string;
  subline?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 break-all font-mono text-xs text-foreground underline-offset-2 hover:underline"
        >
          {url}
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">Not configured</p>
      )}
      <p
        className={cn(
          "text-xs font-medium",
          ok
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-destructive",
        )}
      >
        {statusLine ?? (ok ? "Healthy" : "Unavailable")}
      </p>
      {subline ? (
        <p className="text-xs text-muted-foreground">{subline}</p>
      ) : null}
      {error ? (
        <p className="text-xs leading-relaxed text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function SystemHealthDetails({
  health,
  checking,
  onRefresh,
  refreshing,
  localScope,
}: {
  health: ProductionSystemHealth | null;
  checking: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  localScope: boolean;
}) {
  const website = health?.website ?? null;
  const backend = health?.backend ?? null;
  const api = health?.api ?? null;
  const websiteLabel = localScope ? "Local Website" : "Live Website";

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {localScope ? "Local Services" : "Production Services"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={checking || refreshing}
          aria-label="Refresh system health"
        >
          <RefreshCw
            className={cn("size-3.5", (checking || refreshing) && "animate-spin")}
          />
        </Button>
      </div>

      <div className="space-y-4">
        <DetailRow
          label={websiteLabel}
          ok={Boolean(website?.ok)}
          url={website?.url || undefined}
          statusLine={
            website?.ok
              ? "✓ Reachable"
              : website?.url
                ? "✗ Unreachable"
                : undefined
          }
          subline={
            website?.httpStatus
              ? `${website.httpStatus} ${website.statusText ?? "OK"} · ${formatResponseTime(website.responseTimeMs)}`
              : undefined
          }
          error={website?.error}
        />

        <DetailRow
          label="Backend"
          ok={Boolean(backend?.ok)}
          url={backend?.endpoint || undefined}
          statusLine={
            backend?.ok
              ? "✓ Healthy"
              : backend?.url
                ? "✗ Unhealthy"
                : undefined
          }
          subline={
            backend?.httpStatus
              ? `${backend.httpStatus} ${backend.statusText ?? "OK"} · ${formatResponseTime(backend.responseTimeMs)}`
              : undefined
          }
          error={backend?.error}
        />

        <DetailRow
          label="API"
          ok={Boolean(api?.ok)}
          url={api?.endpoint || undefined}
          statusLine={
            api?.ok
              ? "✓ Operational"
              : api?.endpoint
                ? "✗ Unavailable"
                : undefined
          }
          subline={
            api?.httpStatus
              ? `${api.httpStatus} ${api.statusText ?? "OK"} · ${formatResponseTime(api.responseTimeMs)}`
              : undefined
          }
          error={api?.error}
        />
      </div>

      <p className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        Last checked{" "}
        {health?.checkedAt ? formatTime(health.checkedAt) : checking ? "…" : "—"}
      </p>
    </div>
  );
}

export function ProductionSystemStatus() {
  const { mode } = useAdminDataMode();
  const [health, setHealth] = useState<ProductionSystemHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);

  const scope =
    mode === "dev" ? "local" : mode === "production" ? "production" : null;
  const localScope = scope === "local";

  const fetchHealth = useCallback(async () => {
    if (!scope) {
      throw new Error("System health scope is not available");
    }
    const res = await fetch(
      `/api/admin/production-system-health?scope=${scope}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(`Health check failed (${res.status})`);
    }
    return res.json() as Promise<ProductionSystemHealth>;
  }, [scope]);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) setChecking(true);
      else setRefreshing(true);
      try {
        const next = await fetchHealth();
        setHealth(next);
      } catch {
        setHealth(null);
      } finally {
        if (!silent) setChecking(false);
        else setRefreshing(false);
      }
    },
    [fetchHealth],
  );

  useEffect(() => {
    if (!scope) {
      setHealth(null);
      return;
    }
    void load();
  }, [scope, load]);

  useEffect(() => {
    if (!localScope) return;
    if (health?.backend?.ok && health?.api?.ok) return;

    const interval = window.setInterval(() => {
      void load({ silent: true });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [localScope, health?.backend?.ok, health?.api?.ok, load]);

  const websiteChip = useMemo(
    () => resolveWebsiteChip(health?.website ?? null, checking, localScope),
    [health?.website, checking, localScope],
  );
  const backendChip = useMemo(
    () => resolveBackendChip(health?.backend ?? null, checking),
    [health?.backend, checking],
  );
  const apiChip = useMemo(
    () => resolveApiChip(health?.api ?? null, checking),
    [health?.api, checking],
  );

  const overall = useMemo(
    () => aggregateState(websiteChip, backendChip, apiChip),
    [websiteChip, backendChip, apiChip],
  );

  if (!scope) return null;

  const overallLabel =
    overall === "checking"
      ? "Checking…"
      : overall === "healthy"
        ? localScope
          ? "Local Healthy"
          : "System Healthy"
        : overall === "failed"
          ? localScope
            ? "Local Issues"
            : "System Issues"
          : localScope
            ? "Local Degraded"
            : "System Degraded";

  const overallMeta: ChipMeta = {
    label: overallLabel,
    state: overall,
    className: STATE_STYLES[overall],
    icon: STATE_ICONS[overall],
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={
              localScope ? "Local system status" : "Production system status"
            }
          />
        }
      >
        <span className="hidden items-center gap-1.5 md:inline-flex">
          <StatusChip meta={websiteChip} />
          <StatusChip meta={backendChip} />
          <StatusChip meta={apiChip} />
        </span>
        <span className="md:hidden">
          <StatusChip meta={overallMeta} />
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(calc(100vw-2rem),360px)]">
        <SystemHealthDetails
          health={health}
          checking={checking}
          refreshing={refreshing}
          onRefresh={() => void load({ silent: true })}
          localScope={localScope}
        />
      </PopoverContent>
    </Popover>
  );
}
