import { getAdapter } from "../adapters/base.mjs";
import { buildImages } from "./build.mjs";
import { compileEnvBundles, loadManifest } from "./config-compiler.mjs";
import { ensureBundledDataLayer } from "./data-layer.mjs";
import { runMigrations } from "./migrate.mjs";
import { assertFreshSafety, recreateBundledVolume } from "./safety.mjs";
import { saveState } from "./state.mjs";
import { imageName } from "./types.mjs";
import { validateDeployContext } from "./validate.mjs";
import { printManualChecklist, verifyDeployment } from "./verify.mjs";
import { writeCompiledEnv } from "./write-compiled.mjs";

export async function runDryRun(options) {
  const environment = options.environment ?? "production";
  const { manifest, path: manifestFile } = loadManifest(environment);
  const provider = options.provider ?? manifest.provider ?? "local";
  const topology = options.topology ?? manifest.topology ?? "budget";
  const ctx = {
    environment,
    manifest: { ...manifest, topology },
    topology,
    options: { ...options, provider },
  };
  validateDeployContext(ctx);
  ctx.compiled = compileEnvBundles(ctx);
  ctx.envPaths = writeCompiledEnv(environment, ctx.compiled.bundles);
  assertFreshSafety(ctx);
  console.log("[dry-run] manifest:", manifestFile);
  console.log("[dry-run] compiled env:", ctx.envPaths);
  console.log("[dry-run] data mode:", ctx.compiled.meta.dataMode);
  console.log("[dry-run] ok");
}

export async function runDeploy(options) {
  const environment = options.environment ?? "production";
  const { manifest, usingExample, path: manifestFile } = loadManifest(environment);
  manifest.environment = environment;

  const provider = options.provider ?? manifest.provider ?? "local";
  const topology = options.topology ?? manifest.topology ?? "budget";
  const ctx = {
    environment,
    manifest: { ...manifest, topology },
    topology,
    options: { ...options, provider },
  };

  console.log(
    `[deploy] environment=${environment} provider=${provider} topology=${topology} fresh=${Boolean(options.fresh)}`,
  );
  if (usingExample) {
    console.warn(`[deploy] using example manifest: ${manifestFile}`);
  }

  validateDeployContext(ctx);

  ctx.compiled = compileEnvBundles(ctx);
  ctx.envPaths = writeCompiledEnv(environment, ctx.compiled.bundles);

  const safety = assertFreshSafety(ctx);
  ctx.safety = safety;
  if (options.confirmRecreateData && options.iAcceptDataLoss) {
    recreateBundledVolume(safety.volumeName, options);
  }

  if (!options.skipBuild) {
    ctx.images = buildImages(ctx);
  } else {
    ctx.images = {
      backend: imageName(manifest, "backend"),
      worker: imageName(manifest, "worker"),
      wallet: imageName(manifest, "wallet"),
      admin: imageName(manifest, "admin"),
      marketing: imageName(manifest, "marketing"),
    };
  }

  const adapter = getAdapter(provider);

  if (options.fresh) {
    await adapter.provision(ctx);
  }

  ensureBundledDataLayer(ctx);

  if (!options.skipMigrate) {
    runMigrations(ctx);
  }

  await adapter.release(ctx);

  await verifyDeployment(ctx);
  printManualChecklist(manifest, { provider });

  saveState(environment, {
    provider,
    topology,
    images: ctx.images,
    manifestFile,
    lastDeploy: new Date().toISOString(),
  });

  console.log("[deploy] complete");
}
