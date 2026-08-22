import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runCompose } from "../../core/compose.mjs";
import { repoRoot } from "../../core/types.mjs";

function walletReloadScript() {
  const root = process.env.TMC_REPO_ROOT?.trim() || repoRoot;
  return join(root, "deploy/scripts/reload-production-wallet.sh");
}

function releaseViaReloadScript(ctx, onLog) {
  const script = walletReloadScript();
  if (!existsSync(script)) {
    return null;
  }
  const projectName =
    ctx.manifest?.compose?.project_name ??
    process.env.TMC_COMPOSE_PROJECT_NAME ??
    "tmc-production-micro";
  onLog?.(`[reload-wallet] ${script}`);
  const result = spawnSync("bash", [script], {
    env: {
      ...process.env,
      TMC_REPO_ROOT: process.env.TMC_REPO_ROOT?.trim() || repoRoot,
      TMC_COMPOSE_PROJECT_NAME: projectName,
    },
    encoding: "utf8",
  });
  if (result.stdout) {
    for (const line of result.stdout.split("\n")) {
      if (line.trim()) onLog?.(line.trimEnd());
    }
  }
  if (result.stderr) {
    for (const line of result.stderr.split("\n")) {
      if (line.trim()) onLog?.(line.trimEnd());
    }
  }
  return result.status ?? 1;
}

export const localConfigAdapter = {
  async releaseConfigOnly(ctx) {
    const onLog = ctx.onLog;
    const logOpts = onLog ? { onLog } : {};

    if (ctx.changedKey === "META_PIXEL_ID") {
      const scriptStatus = releaseViaReloadScript(ctx, onLog);
      if (scriptStatus !== null) {
        if (scriptStatus !== 0) {
          throw new Error("wallet reload script failed — is Docker available on the VPS?");
        }
        return;
      }
      if (
        runCompose(ctx, ["up", "-d", "--no-deps", "--force-recreate", "wallet"], logOpts) !==
        0
      ) {
        throw new Error(
          "docker compose wallet recreate failed — run ./deploy.sh production --provider docker-vps",
        );
      }
      return;
    }

    const services = ["backend", "wallet", "caddy"];
    if (runCompose(ctx, ["up", "-d", ...services], logOpts) !== 0) {
      throw new Error("docker compose config-only release failed");
    }
    if (ctx.changedKey === "WEBSITE_DOMAIN") {
      if (runCompose(ctx, ["restart", "caddy"], logOpts) !== 0) {
        throw new Error("docker compose caddy restart failed after domain change");
      }
    }
  },
};
