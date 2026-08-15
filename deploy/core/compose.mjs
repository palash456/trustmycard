import { spawnSync } from "child_process";
import { join } from "path";
import { deployRoot } from "./types.mjs";

export function composeFiles(ctx) {
  const { manifest } = ctx;
  const composeDir = join(deployRoot, "compose");
  const files = [join(composeDir, "docker-compose.base.yml")];
  if (manifest.topology === "full") {
    files.push(join(composeDir, "docker-compose.full.yml"));
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
  const compiled = join(deployRoot, "compiled", environment);
  const env = {
    TMC_COMPOSE_PROJECT_NAME: project,
    TMC_COMPILED_ENV_BACKEND: join(compiled, "backend.env"),
    TMC_COMPILED_ENV_API: join(compiled, "api.env"),
    TMC_COMPILED_ENV_WORKER: join(compiled, "worker.env"),
    TMC_COMPILED_ENV_WALLET: join(compiled, "wallet.env"),
    TMC_COMPILED_ENV_ADMIN: join(compiled, "admin.env"),
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

export function runCompose(ctx, args, extra = {}) {
  const files = composeFiles(ctx);
  const fileArgs = files.flatMap((f) => ["-f", f]);
  const env = { ...process.env, ...composeEnv(ctx), ...(extra.env ?? {}) };
  const project = manifestProject(ctx);
  const fullArgs = [
    "compose",
    "-p",
    project,
    ...fileArgs,
    ...(extra.profile ? ["--profile", extra.profile] : []),
    ...args,
  ];
  const result = spawnSync("docker", fullArgs, {
    stdio: "inherit",
    env,
  });
  return result.status ?? 1;
}

function manifestProject(ctx) {
  return (
    ctx.manifest.compose?.project_name ??
    `tmc-${ctx.environment ?? "production"}`
  );
}
