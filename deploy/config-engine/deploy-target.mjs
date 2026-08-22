import { existsSync } from "node:fs";
import { join } from "node:path";
import { deployRoot } from "../core/types.mjs";

/**
 * Config-only deploy from the production API container on the VPS:
 * write compiled env + restart services via the host Docker socket (no SSH/rsync).
 */
export function shouldUseLocalVpsConfigDeploy() {
  const override = process.env.TMC_CONFIG_DEPLOY_LOCAL?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;

  const credsPath = join(deployRoot, "provider.credentials.env");
  return existsSync("/var/run/docker.sock") && !existsSync(credsPath);
}
