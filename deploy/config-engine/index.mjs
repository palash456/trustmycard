import { loadManifest } from "../core/config-compiler.mjs";
import { readAuditHistory } from "./audit.mjs";
import { readRuntimeState } from "./runtime-state.mjs";
import { runConfigUpdate } from "./update-workflow.mjs";
import { dockerVpsConfigAdapter } from "./adapters/docker-vps-config.mjs";
import { localConfigAdapter } from "./adapters/local-config.mjs";
export async function getProductionConfig(environment = "production") {
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
