import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { deployRoot, repoRoot } from "../core/types.mjs";
import { shouldUseLocalVpsConfigDeploy } from "./deploy-target.mjs";

/** Dev machine → VPS updates need runtime JSON on the server for production admin. */
export function shouldSyncRuntimeConfigToVps(provider, environment = "production") {
  if (environment !== "production") return false;
  if (provider !== "docker-vps") return false;
  if (shouldUseLocalVpsConfigDeploy()) return false;
  return existsSync(join(deployRoot, "provider.credentials.env"));
}

/**
 * Upload deploy/runtime-config/production.json (+ audit) to the VPS.
 * Same as `npm run config:sync-vps`.
 */
export function syncRuntimeConfigToVps(environment = "production", options = {}) {
  const script = join(repoRoot, "deploy/scripts/sync-runtime-config-to-vps.sh");
  const onLog = options.onLog;
  onLog?.(`Running config:sync-vps (${environment})`);
  const result = spawnSync(script, [environment], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  for (const line of combined.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) onLog?.(trimmed);
  }
  if (result.status !== 0) {
    throw new Error(
      `Runtime config VPS sync failed (exit ${result.status ?? "unknown"}). ` +
        "Fix deploy/provider.credentials.env or run: npm run config:sync-vps",
    );
  }
}
