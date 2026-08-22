import { existsSync } from "node:fs";
import { join } from "node:path";
import { deployRoot } from "./types.mjs";

/** Local runtime-config directory (repo or TMC_RUNTIME_CONFIG_DIR override). */
export function localRuntimeConfigDir() {
  const override = process.env.TMC_RUNTIME_CONFIG_DIR?.trim();
  if (override) return override;
  return join(deployRoot, "runtime-config");
}

/** Remote runtime-config path on the VPS (from provider.credentials.env). */
export function remoteRuntimeConfigDir(creds, remoteDeployPath) {
  const base = creds.VPS_RUNTIME_CONFIG_DIR?.trim() ||
    `${remoteDeployPath || creds.VPS_DEPLOY_PATH || "/opt/tmc"}/deploy/runtime-config`;
  return base;
}

/**
 * Files to rsync for runtime state sync. Returns null when local state is missing.
 * @param {string} environment
 * @param {string} [localDir]
 */
export function runtimeConfigSyncPlan(environment, localDir = localRuntimeConfigDir()) {
  const stateFile = join(localDir, `${environment}.json`);
  if (!existsSync(stateFile)) return null;
  const auditFile = join(localDir, "audit.ndjson");
  return {
    stateFile,
    auditFile,
    hasAudit: existsSync(auditFile),
    remoteStatePath: `${environment}.json`,
  };
}
