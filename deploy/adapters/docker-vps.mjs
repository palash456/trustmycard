import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { composeEnv, composeFiles } from "../core/compose.mjs";
import { transferImagesToHost } from "../core/image-transfer.mjs";
import { deployRoot, repoRoot } from "../core/types.mjs";
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

function expandHome(path) {
  if (!path) return path;
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function sshTarget(creds) {
  const user = creds.VPS_USER || "deploy";
  const host = creds.VPS_HOST;
  if (!host) throw new Error("VPS_HOST is required");
  return `${user}@${host}`;
}

function sshBaseArgs(creds) {
  const args = ["-o", "StrictHostKeyChecking=accept-new"];
  if (creds.VPS_SSH_KEY) {
    args.push("-i", expandHome(creds.VPS_SSH_KEY));
  }
  return args;
}

function rsyncSshCommand(creds) {
  return ["ssh", ...sshBaseArgs(creds)].join(" ");
}

function sshExec(creds, remoteCommand) {
  const result = spawnSync(
    "ssh",
    [...sshBaseArgs(creds), sshTarget(creds), remoteCommand],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("SSH command failed");
}

function rsyncToRemote(creds, src, remoteDestPath) {
  if (!existsSync(src)) {
    throw new Error(`Missing deploy bundle path: ${src}`);
  }
  const remote = `${sshTarget(creds)}:${remoteDestPath}`;
  const result = spawnSync(
    "rsync",
    ["-az", "-e", rsyncSshCommand(creds), `${src}/`, remote],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`rsync failed for ${src}`);
}

function rsyncFileToRemote(creds, src, remoteDestPath) {
  if (!existsSync(src)) {
    throw new Error(`Missing deploy bundle path: ${src}`);
  }
  const remote = `${sshTarget(creds)}:${remoteDestPath}`;
  const result = spawnSync(
    "rsync",
    ["-az", "-e", rsyncSshCommand(creds), src, remote],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`rsync failed for ${src}`);
}

function rsyncBundle(creds, remotePath, environment) {
  sshExec(creds, `mkdir -p ${remotePath}/deploy/compiled/${environment}`);

  rsyncToRemote(
    creds,
    join(deployRoot, "compose"),
    `${remotePath}/deploy/compose/`,
  );
  const caddyDir = join(deployRoot, "caddy");
  if (existsSync(caddyDir)) {
    rsyncToRemote(creds, caddyDir, `${remotePath}/deploy/caddy/`);
  }
  rsyncToRemote(
    creds,
    join(deployRoot, "compiled", environment),
    `${remotePath}/deploy/compiled/${environment}/`,
  );

  const configEngineDir = join(deployRoot, "config-engine");
  if (existsSync(configEngineDir)) {
    rsyncToRemote(creds, configEngineDir, `${remotePath}/deploy/config-engine/`);
  }
  const configUpdateScript = join(repoRoot, "scripts", "config-update.sh");
  if (existsSync(configUpdateScript)) {
    sshExec(creds, `mkdir -p ${remotePath}/scripts`);
    rsyncFileToRemote(
      creds,
      configUpdateScript,
      `${remotePath}/scripts/config-update.sh`,
    );
    sshExec(creds, `chmod +x ${remotePath}/scripts/config-update.sh`);
  }

  const manifest = join(deployRoot, `manifest.${environment}.json`);
  if (existsSync(manifest)) {
    rsyncFileToRemote(
      creds,
      manifest,
      `${remotePath}/deploy/manifest.${environment}.json`,
    );
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
    const components =
      ctx.options?.configOnlyServices ??
      releaseComponents(ctx.topology, ctx.options);
    const imageTags = components
      .filter((name) => name !== "caddy")
      .map((name) => {
        const key = name === "api" ? "backend" : name;
        return ctx.images?.[key];
      })
      .filter(Boolean);

    console.log(
      `[adapter:docker-vps] ${ctx.options?.skipImages ? "release" : "transfer images + release"} on ${creds.VPS_HOST} (no remote build)`,
    );
    if (!ctx.options?.skipImages) {
      await transferImagesToHost(creds, imageTags);
    } else {
      console.log(
        "[adapter:docker-vps] --skip-images: reusing images already on VPS",
      );
    }
    rsyncBundle(creds, creds.VPS_DEPLOY_PATH || "/opt/tmc", ctx.environment);
    sshExec(
      creds,
      remoteComposeCommand(ctx, [
        "up",
        "-d",
        ...(ctx.options?.configOnlyServices ? [] : ["--remove-orphans"]),
        ...components,
      ]),
    );
    const forceRestart = ctx.options?.forceRestartServices ?? [];
    if (forceRestart.length > 0) {
      console.log(
        `[adapter:docker-vps] restarting ${forceRestart.join(", ")} after config sync`,
      );
      sshExec(creds, remoteComposeCommand(ctx, ["restart", ...forceRestart]));
    }
  },
};
