import { compileCaddyfile, compileEnvBundles } from "./config-compiler.mjs";
import { validateDeployContext } from "./validate.mjs";
import { writeCompiledEnv } from "./write-compiled.mjs";

const CONFIG_ONLY_MESSAGES = [
  "CONFIGURATION-ONLY DEPLOYMENT",
  "Docker image rebuild: SKIPPED",
  "Database migration: SKIPPED",
];

export function preflightConfiguration(ctx) {
  validateDeployContext(ctx);
  const compiled = compileEnvBundles(ctx, ctx.runtimeState);
  const needsCaddy =
    ctx.environment === "production" && ctx.changedKey !== "META_PIXEL_ID";
  if (needsCaddy) {
    compileCaddyfile(compiled.meta.origins.websiteDomain);
  }
  ctx.compiled = compiled;
  return compiled;
}

export async function runConfigurationOnlyRelease(
  ctx,
  { onEvent, adapter } = {},
) {
  if (!ctx.compiled) {
    preflightConfiguration(ctx);
  }
  ctx.envPaths = writeCompiledEnv(
    ctx.environment,
    ctx.compiled.bundles,
    ctx.environment === "production"
      ? compileCaddyfile(ctx.compiled.meta.origins.websiteDomain)
      : undefined,
  );
  for (const message of CONFIG_ONLY_MESSAGES) {
    console.log(message);
    onEvent?.({
      phase: "restart",
      message,
      at: new Date().toISOString(),
    });
  }
  const selected = adapter ?? ctx.configAdapter;
  if (!selected?.releaseConfigOnly)
    throw new Error("Configuration-only adapter is unavailable");
  ctx.onLog = (message) =>
    onEvent?.({ phase: "log", message, at: new Date().toISOString() });
  await selected.releaseConfigOnly(ctx);
  return ctx.compiled.meta;
}
