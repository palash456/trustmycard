import { spawnSync } from "child_process";
import { join } from "path";
import { deployRoot } from "./types.mjs";

export function composeFiles(ctx) {
  const { manifest } = ctx;
  const composeDir = join(deployRoot, "compose");
  const files = [join(composeDir, "docker-compose.base.yml")];
  if (manifest.topology === "full") {
    files.push(join(composeDir, "docker-compose.full.yml"));
  } else if (manifest.topology === "micro") {
    files.push(join(composeDir, "docker-compose.micro.yml"));
    if ((manifest.data?.mode ?? "bundled") === "bundled") {
      files.push(join(composeDir, "docker-compose.micro-bundled.yml"));
    }
    if (ctx.options?.provider === "docker-vps") {
      files.push(join(composeDir, "docker-compose.micro-edge.yml"));
    }
  } else {
    files.push(join(composeDir, "docker-compose.budget.yml"));
  }
  if ((manifest.data?.mode ?? "bundled") === "external") {
    files.push(join(composeDir, "docker-compose.external-data.yml"));
  }
  return files;
}

export function composeEnv(ctx) {
  const { manifest, environment, images } = ctx;
  const project = manifest.compose?.project_name ?? `tmc-${environment}`;
  const compiledRel = `../compiled/${environment}`;
  const env = {
    TMC_COMPOSE_PROJECT_NAME: project,
    TMC_COMPILED_ENV_BACKEND: `${compiledRel}/backend.env`,
    TMC_COMPILED_ENV_API: `${compiledRel}/api.env`,
    TMC_COMPILED_ENV_WORKER: `${compiledRel}/worker.env`,
    TMC_COMPILED_ENV_WALLET: `${compiledRel}/wallet.env`,
    TMC_COMPILED_ENV_ADMIN: `${compiledRel}/admin.env`,
    TMC_POSTGRES_USER: manifest.data?.bundled?.postgres_user ?? "trustmycard",
    TMC_POSTGRES_PASSWORD:
      manifest.data?.bundled?.postgres_password ?? "trustmycard_local_deploy",
    TMC_POSTGRES_DB: manifest.data?.bundled?.postgres_db ?? "trustmycard",
  };
  if (images?.backend) env.TMC_IMAGE_BACKEND = images.backend;
  if (images?.worker) env.TMC_IMAGE_WORKER = images.worker;
  if (images?.wallet) env.TMC_IMAGE_WALLET = images.wallet;
  if (images?.admin) env.TMC_IMAGE_ADMIN = images.admin;
  if (images?.marketing) env.TMC_IMAGE_MARKETING = images.marketing;
  return env;
}

function emitCapturedLines(buffer, onLog) {
  if (!buffer || typeof onLog !== "function") return;
  for (const line of buffer.toString().split("\n")) {
    const trimmed = line.trimEnd();
    if (trimmed) onLog(trimmed);
  }
}

export function runCompose(ctx, args, extra = {}) {
  const files = composeFiles(ctx);
  const fileArgs = files.flatMap((f) => ["-f", f]);
  const env = { ...process.env, ...composeEnv(ctx), ...(extra.env ?? {}) };
  const project = manifestProject(ctx);
  const { command, prefix } = resolveComposeInvocation();
  const fullArgs = [
    ...prefix,
    "-p",
    project,
    ...fileArgs,
    ...(extra.profile ? ["--profile", extra.profile] : []),
    ...args,
  ];
  const onLog = extra.onLog;
  const captureLogs = typeof onLog === "function";
  const result = spawnSync(command, fullArgs, {
    stdio: captureLogs ? ["ignore", "pipe", "pipe"] : "inherit",
    env,
    encoding: captureLogs ? "utf8" : undefined,
  });
  if (captureLogs) {
    emitCapturedLines(result.stdout, onLog);
    emitCapturedLines(result.stderr, onLog);
  }
  return result.status ?? 1;
}

function manifestProject(ctx) {
  return (
    ctx.manifest.compose?.project_name ??
    `tmc-${ctx.environment ?? "production"}`
  );
}

let composeInvocation;
function resolveComposeInvocation() {
  if (composeInvocation) return composeInvocation;
  const probe = spawnSync("docker", ["compose", "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  composeInvocation =
    probe.status === 0
      ? { command: "docker", prefix: ["compose"] }
      : { command: "docker-compose", prefix: [] };
  return composeInvocation;
}
