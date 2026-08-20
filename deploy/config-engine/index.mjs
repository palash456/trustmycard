import { loadManifest } from "../core/config-compiler.mjs";
import { repoRoot } from "../core/types.mjs";
import { readAuditHistory } from "./audit.mjs";
import { readRuntimeState } from "./runtime-state.mjs";
import { runConfigUpdate } from "./update-workflow.mjs";
import { dockerVpsConfigAdapter } from "./adapters/docker-vps-config.mjs";
import { localConfigAdapter } from "./adapters/local-config.mjs";
import { readPlatformDefaults, resolveManagedPlatformValues } from "./validators.mjs";

export async function getProductionConfig(environment = "production") {
  const platformDefaults = readPlatformDefaults(repoRoot);
  const runtime = readRuntimeState(environment);
  const resolved = resolveManagedPlatformValues(platformDefaults, runtime);
  const websiteDomain = resolved.WEBSITE_DOMAIN;
  const metaPixelId = resolved.META_PIXEL_ID;
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
    },
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
