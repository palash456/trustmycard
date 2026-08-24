import {
  loadManifest,
  normalizeWebsiteDomain,
} from "../core/config-compiler.mjs";
import { repoRoot } from "../core/types.mjs";
import { readAuditHistory } from "./audit.mjs";
import { tryReadDeployedManagedValues } from "./migrate-init.mjs";
import { readRuntimeState } from "./runtime-state.mjs";
import { runConfigUpdate } from "./update-workflow.mjs";
import { dockerVpsConfigAdapter } from "./adapters/docker-vps-config.mjs";
import { localConfigAdapter } from "./adapters/local-config.mjs";
import { isConfigOnlyDeploy } from "./deploy-target.mjs";
import { readPlatformDefaults, resolveManagedPlatformValues } from "./validators.mjs";

function managedConfigDrift(runtime, deployed) {
  if (!deployed) return {};
  const runtimeDomain = normalizeWebsiteDomain(runtime.WEBSITE_DOMAIN ?? "");
  const runtimePixel = runtime.META_PIXEL_ID?.trim() ?? "";
  const deployedDomain = deployed.WEBSITE_DOMAIN?.trim() ?? "";
  const deployedPixel = deployed.META_PIXEL_ID?.trim() ?? "";
  return {
    WEBSITE_DOMAIN:
      Boolean(runtimeDomain && deployedDomain) &&
      runtimeDomain !== deployedDomain,
    META_PIXEL_ID:
      Boolean(runtimePixel && deployedPixel) && runtimePixel !== deployedPixel,
  };
}

const SYNC_WARNING_MESSAGE =
  "VPS runtime config was updated via admin panel. Run 'npm run config:pull-vps' before next local deploy to avoid overwriting these changes.";
const SYNC_WARNING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function buildDriftSummary(configDrift) {
  const driftedKeys = Object.entries(configDrift ?? {})
    .filter(([, drifted]) => drifted)
    .map(([key]) => key);
  return {
    hasDrift: driftedKeys.length > 0,
    driftedKeys,
  };
}

function buildSyncWarning(runtime) {
  const source = runtime.lastSource?.trim();
  const updatedMs = Date.parse(String(runtime.lastUpdatedAt ?? ""));
  const isRecent =
    Number.isFinite(updatedMs) &&
    Date.now() - updatedMs <= SYNC_WARNING_WINDOW_MS;
  const show = source === "WEB_PORTAL" && isRecent;
  return {
    show,
    message: show ? SYNC_WARNING_MESSAGE : "",
  };
}

export async function getProductionConfig(environment = "production") {
  const platformDefaults = readPlatformDefaults(repoRoot);
  const runtime = readRuntimeState(environment);
  const resolved = resolveManagedPlatformValues(platformDefaults, runtime);
  const websiteDomain = resolved.WEBSITE_DOMAIN;
  const metaPixelId = resolved.META_PIXEL_ID;
  const deployedValues = tryReadDeployedManagedValues(environment);
  const configDrift = managedConfigDrift(runtime, deployedValues);
  const drift = buildDriftSummary(configDrift);
  const syncWarning = buildSyncWarning(runtime);
  const usesPlatform =
    Boolean(platformDefaults.WEBSITE_DOMAIN) ||
    Boolean(platformDefaults.META_PIXEL_ID);
  const usesRuntime =
    !platformDefaults.WEBSITE_DOMAIN && Boolean(runtime.WEBSITE_DOMAIN?.trim());
  const usesRuntimePixel =
    !platformDefaults.META_PIXEL_ID && Boolean(runtime.META_PIXEL_ID?.trim());
  return {
    ...runtime,
    WEBSITE_DOMAIN: websiteDomain,
    META_PIXEL_ID: metaPixelId,
    source: usesPlatform
      ? "PLATFORM_ENV"
      : usesRuntime || usesRuntimePixel
        ? "RUNTIME_CONFIG"
        : "UNRESOLVED",
    platformDefaults,
    runtimeState: {
      WEBSITE_DOMAIN: runtime.WEBSITE_DOMAIN,
      META_PIXEL_ID: runtime.META_PIXEL_ID,
      lastUpdatedAt: runtime.lastUpdatedAt,
      lastUpdatedBy: runtime.lastUpdatedBy,
      lastSource: runtime.lastSource,
    },
    deployedValues: deployedValues
      ? {
          WEBSITE_DOMAIN: deployedValues.WEBSITE_DOMAIN,
          META_PIXEL_ID: deployedValues.META_PIXEL_ID,
        }
      : null,
    configDrift,
    drift,
    syncWarning,
  };
}
export async function getConfigHistory(environment = "production", options) {
  return readAuditHistory(environment, options);
}
function adapterFor(provider) {
  if (provider === "docker-vps") return dockerVpsConfigAdapter;
  if (provider === "local") return localConfigAdapter;
  throw new Error(`No config-only adapter for ${provider}`);
}
async function update(key, request) {
  const environment = request.environment ?? "production";
  const { manifest } = loadManifest(environment);
  const provider = request.provider ?? manifest.provider ?? "local";
  return runConfigUpdate({
    ...request,
    environment,
    key,
    deps: {
      ...request.deps,
      adapter: request.adapter ?? request.deps?.adapter ?? adapterFor(provider),
      createContext: async (runtimeState, changedKey) => ({
        environment,
        manifest,
        topology: manifest.topology,
        options: {
          provider,
          source: request.source,
          configOnly: isConfigOnlyDeploy({ source: request.source }),
        },
        runtimeState,
        changedKey,
      }),
    },
  });
}
export async function updateWebsiteDomain(request) {
  return update("WEBSITE_DOMAIN", request);
}
export async function updateMetaPixelId(request) {
  return update("META_PIXEL_ID", request);
}
