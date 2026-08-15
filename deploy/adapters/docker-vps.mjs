import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { runCompose } from "../core/compose.mjs";
import { deployRoot } from "../core/types.mjs";
import { releaseComponents } from "../core/types.mjs";

function loadCredentials() {
  const path = join(deployRoot, "provider.credentials.env");
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path}. Copy deploy/provider.credentials.example.env and fill VPS_* values.`,
    );
  }
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...rest] = t.split("=");
    out[k.trim()] = rest.join("=").trim();
  }
  return out;
}

function sshExec(creds, remoteCommand) {
  const user = creds.VPS_USER || "deploy";
  const host = creds.VPS_HOST;
  if (!host) throw new Error("VPS_HOST is required");
  const key = creds.VPS_SSH_KEY ? `-i ${creds.VPS_SSH_KEY}` : "";
  const cmd = `ssh ${key} -o StrictHostKeyChecking=accept-new ${user}@${host} ${JSON.stringify(remoteCommand)}`;
  const result = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (result.status !== 0) throw new Error("SSH command failed");
}

function rsyncRepo(creds, remotePath) {
  const user = creds.VPS_USER || "deploy";
  const host = creds.VPS_HOST;
  const key = creds.VPS_SSH_KEY ? `-i ${creds.VPS_SSH_KEY}` : "";
  const src = `${deployRoot}/../`;
  const cmd = [
    "rsync",
    "-az",
    "--exclude",
    "node_modules",
    "--exclude",
    ".git",
    "--exclude",
    "deploy/compiled",
    "--exclude",
    "deploy/state",
    "-e",
    `ssh ${key} -o StrictHostKeyChecking=accept-new`,
    src,
    `${user}@${host}:${remotePath}/`,
  ].join(" ");
  const result = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (result.status !== 0) throw new Error("rsync failed");
}

export const dockerVpsAdapter = {
  name: "docker-vps",

  async provision(ctx) {
    const creds = loadCredentials();
    const remotePath = creds.VPS_DEPLOY_PATH || "/opt/tmc";
    console.log(`[adapter:docker-vps] provision on ${creds.VPS_HOST}`);

    if (ctx.options.fresh) {
      const script = readFileSync(
        join(deployRoot, "scripts/provision-vps-docker.sh"),
        "utf8",
      );
      sshExec(creds, script);
    }

    rsyncRepo(creds, remotePath);

    if ((ctx.manifest.data?.mode ?? "bundled") === "bundled") {
      sshExec(
        creds,
        `cd ${remotePath} && docker compose -p ${ctx.manifest.compose?.project_name ?? "tmc-production"} -f deploy/compose/docker-compose.base.yml up -d postgres redis`,
      );
    }
  },

  async release(ctx) {
    const creds = loadCredentials();
    const remotePath = creds.VPS_DEPLOY_PATH || "/opt/tmc";
    const services = releaseComponents(ctx.topology).join(" ");

    console.log(`[adapter:docker-vps] build images + release on ${creds.VPS_HOST}`);
    sshExec(
      creds,
      `cd ${remotePath} && ./deploy.sh ${ctx.environment} --provider local --skip-migrate ${ctx.options.skipBuild ? "--skip-build" : ""}`,
    );
    sshExec(
      creds,
      `cd ${remotePath} && docker compose -p ${ctx.manifest.compose?.project_name ?? "tmc-production"} -f deploy/compose/docker-compose.base.yml -f deploy/compose/docker-compose.${ctx.topology}.yml up -d ${services}`,
    );
  },
};
