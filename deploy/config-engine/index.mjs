import { loadManifest } from "../core/config-compiler.mjs";
import { repoRoot } from "../core/types.mjs";
import { readAuditHistory } from "./audit.mjs";
import { readRuntimeState } from "./runtime-state.mjs";
import { runConfigUpdate } from "./update-workflow.mjs";
import { dockerVpsConfigAdapter } from "./adapters/docker-vps-config.mjs";
import { localConfigAdapter } from "./adapters/local-config.mjs";
import { readManagedPlatformDefaults } from "./validators.mjs";

export async function getProductionConfig(environment = "production") {
  const platformDefaults = readManagedPlatformDefaults(repoRoot);
  if (platformDefaults.active) {
    const runtime = readRuntimeState(environment);
    return {
      ...runtime,
      WEBSITE_DOMAIN: platformDefaults.WEBSITE_DOMAIN || runtime.WEBSITE_DOMAIN,
      META_PIXEL_ID: platformDefaults.META_PIXEL_ID || runtime.META_PIXEL_ID,
      source: "PLATFORM_ENV",
      platformDefaultsActive: true,
      platformDefaults,
    };
  }
  return readRuntimeState(environment);
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
  const platformDefaults = readManagedPlatformDefaults(repoRoot);
  if (platformDefaults.active) {
    return {
      blocked: true,
      reason:
        "Default values already persist in config/platform.env. Empty WEBSITE_DOMAIN and META_PIXEL_ID to enable config-update changes.",
      source: "PLATFORM_ENV",
      platformDefaults,
    };
  }
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
        options: { provider },
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
