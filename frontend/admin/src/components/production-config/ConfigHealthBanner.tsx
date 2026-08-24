import { AlertTriangle } from "lucide-react";

function formatConfigTimestamp(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : null;
}

export type ConfigDriftSummary = {
  hasDrift: boolean;
  driftedKeys: string[];
};

export type ConfigSyncWarning = {
  show: boolean;
  message: string;
};

export type ConfigRuntimeSnapshot = {
  META_PIXEL_ID?: string;
  WEBSITE_DOMAIN?: string;
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
  lastSource?: string;
};

type DeployedValues = {
  META_PIXEL_ID?: string;
  WEBSITE_DOMAIN?: string;
} | null;

function formatDriftMessage(
  driftedKeys: string[],
  runtimeState: ConfigRuntimeSnapshot | undefined,
  deployedValues: DeployedValues,
): string {
  const parts: string[] = [];

  if (driftedKeys.includes("META_PIXEL_ID")) {
    const deployed = deployedValues?.META_PIXEL_ID?.trim() || "(not set)";
    const runtime = runtimeState?.META_PIXEL_ID?.trim() || "(not set)";
    parts.push(
      `Meta Pixel ID — live container has ${deployed} but runtime config says ${runtime}`,
    );
  }

  if (driftedKeys.includes("WEBSITE_DOMAIN")) {
    const deployed = deployedValues?.WEBSITE_DOMAIN?.trim() || "(not set)";
    const runtime = runtimeState?.WEBSITE_DOMAIN?.trim() || "(not set)";
    parts.push(
      `Website domain — compiled env has ${deployed} but runtime config says ${runtime}`,
    );
  }

  const detail =
    parts.length > 0
      ? parts.join("; ")
      : "Runtime state and deployed wallet.env disagree.";

  return `Config Drift Detected — ${detail}. The wallet container may not have restarted yet, or a deploy overwrote the compiled env.`;
}

export function ConfigHealthBanner({
  drift,
  syncWarning,
  runtimeState,
  deployedValues,
}: {
  drift?: ConfigDriftSummary;
  syncWarning?: ConfigSyncWarning;
  runtimeState?: ConfigRuntimeSnapshot;
  deployedValues?: DeployedValues;
}) {
  const showDrift = Boolean(drift?.hasDrift);
  const showSyncWarning = Boolean(syncWarning?.show);

  if (!showDrift && !showSyncWarning) return null;

  const adminUpdatedAt = runtimeState?.lastUpdatedAt
    ? formatConfigTimestamp(runtimeState.lastUpdatedAt)
    : null;

  return (
    <div className="mb-5 space-y-3">
      {showDrift ? (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-orange-200/80 bg-orange-50/60 px-3.5 py-2.5 text-sm text-orange-950/90 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-100/90"
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400"
            aria-hidden
          />
          <p>
            <span className="font-medium">Config drift detected.</span>{" "}
            {formatDriftMessage(
              drift?.driftedKeys ?? [],
              runtimeState,
              deployedValues ?? null,
            )}
          </p>
        </div>
      ) : null}

      {showSyncWarning ? (
        <div
          className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3.5 py-2.5 text-sm text-amber-950/90 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100/90"
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <p>
            <span className="font-medium">Admin changes pending local sync.</span>{" "}
            {adminUpdatedAt
              ? `This config was last updated via the admin panel on ${adminUpdatedAt}. `
              : null}
            {syncWarning?.message ||
              "Run npm run config:pull-vps before your next local deploy to avoid overwriting these changes."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
