import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { composeEnv, composeFiles } from "../core/compose.mjs";
import { transferImagesToHost } from "../core/image-transfer.mjs";
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

function rsyncBundle(creds, remotePath, environment) {
  const user = creds.VPS_USER || "deploy";
  const host = creds.VPS_HOST;
  const key = creds.VPS_SSH_KEY ? `-i ${creds.VPS_SSH_KEY}` : "";
  const ssh = `ssh ${key} -o StrictHostKeyChecking=accept-new`;

  const dirs = [
    { src: join(deployRoot, "compose"), dest: `${remotePath}/deploy/compose/` },
    {
      src: join(deployRoot, "compiled", environment),
      dest: `${remotePath}/deploy/compiled/${environment}/`,
    },
  ];
  for (const { src, dest } of dirs) {
    if (!existsSync(src)) {
      throw new Error(`Missing deploy bundle path: ${src}`);
    }
    const cmd = ["rsync", "-az", "-e", ssh, `${src}/`, dest].join(" ");
    const result = spawnSync(cmd, { shell: true, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`rsync failed for ${src}`);
  }

  const manifest = join(deployRoot, `manifest.${environment}.json`);
  if (existsSync(manifest)) {
    const cmd = [
      "rsync",
      "-az",
      "-e",
      ssh,
      manifest,
      `${remotePath}/deploy/manifest.${environment}.json`,
    ].join(" ");
    const result = spawnSync(cmd, { shell: true, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`rsync failed for ${manifest}`);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function remoteComposeCommand(ctx, args) {
  const creds = loadCredentials();
  const remotePath = creds.VPS_DEPLOY_PATH || "/opt/tmc";
  const project =
    ctx.manifest.compose?.project_name ??
    `tmc-${ctx.environment ?? "production"}`;
  const files = composeFiles(ctx)
    .map((file) => `-f ${file.replace(`${deployRoot}/`, "deploy/")}`)
    .join(" ");
  const env = composeEnv(ctx);
  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
  return `cd ${remotePath} && ${envPrefix} docker compose -p ${shellQuote(project)} ${files} ${args.join(" ")}`;
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
      sshExec(creds, `mkdir -p ${remotePath}/deploy`);
    }

    rsyncBundle(creds, remotePath, ctx.environment);

    if ((ctx.manifest.data?.mode ?? "bundled") === "bundled") {
      sshExec(
        creds,
        remoteComposeCommand(ctx, ["up", "-d", "postgres", "redis"]),
      );
    }
  },

  async release(ctx) {
    const creds = loadCredentials();
    const imageTags = Object.values(ctx.images ?? {});
    const services = releaseComponents(ctx.topology).join(" ");

    console.log(
      `[adapter:docker-vps] transfer images + release on ${creds.VPS_HOST} (no remote build)`,
    );
    transferImagesToHost(creds, imageTags);
    rsyncBundle(creds, creds.VPS_DEPLOY_PATH || "/opt/tmc", ctx.environment);
    sshExec(creds, remoteComposeCommand(ctx, ["up", "-d", "--remove-orphans", ...services.split(" ")]));
  },
};
