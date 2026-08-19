import { existsSync } from "node:fs";
import { join } from "node:path";
import { deployRoot } from "../core/types.mjs";

const VPS_RUNTIME_CONFIG_DIR = "/opt/tmc/deploy/runtime-config";

export function runtimeConfigDir(environment) {
  if (process.env.TMC_RUNTIME_CONFIG_DIR) {
    return process.env.TMC_RUNTIME_CONFIG_DIR;
  }
  if (environment === "production" && existsSync(VPS_RUNTIME_CONFIG_DIR)) {
    return VPS_RUNTIME_CONFIG_DIR;
  }
  return join(deployRoot, "runtime-config");
}

export function runtimeStatePath(environment) {
  return join(runtimeConfigDir(environment), `${environment}.json`);
}

export function auditLogPath(environment) {
  return join(runtimeConfigDir(environment), "audit.ndjson");
}

export function lockPath(environment) {
  return join(runtimeConfigDir(environment), ".update.lock");
}
