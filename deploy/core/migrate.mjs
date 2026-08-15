import { spawnSync } from "child_process";
import { join } from "path";
import { composeEnv, composeFiles } from "./compose.mjs";
import { compiledDir, imageName } from "./types.mjs";

function manifestProject(ctx) {
  return (
    ctx.manifest.compose?.project_name ??
    `tmc-${ctx.environment ?? "production"}`
  );
}

export function runMigrations(ctx) {
  const mode = ctx.manifest.data?.mode ?? "bundled";
  console.log("[migrate] prisma migrate deploy");

  if (mode === "bundled") {
    const code = runComposeMigrate(ctx);
    if (code !== 0) throw new Error("Database migration failed");
    return;
  }

  const envFile = join(compiledDir(ctx.environment), "backend.env");
  const image = ctx.images?.backend ?? imageName(ctx.manifest, "backend");
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--env-file",
      envFile,
      "-e",
      "TMC_ENV=production",
      "-e",
      "SERVICE_ROLE=api",
      image,
      "npx",
      "prisma",
      "migrate",
      "deploy",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("Database migration failed");
}

function runComposeMigrate(ctx) {
  const files = composeFiles(ctx);
  const fileArgs = files.flatMap((f) => ["-f", f]);
  const env = { ...process.env, ...composeEnv(ctx) };
  const project = manifestProject(ctx);
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-p",
      project,
      ...fileArgs,
      "--profile",
      "migrate",
      "run",
      "--rm",
      "migrate",
    ],
    { stdio: "inherit", env },
  );
  return result.status ?? 1;
}
