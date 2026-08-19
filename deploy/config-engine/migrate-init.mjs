#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { appendAuditRecord } from "./audit.mjs";
import { allocateChangeId } from "./change-id.mjs";
import { RUNTIME_STATE_SCHEMA_VERSION } from "./constants.mjs";
import { runtimeStateExists, writeRuntimeState } from "./runtime-state.mjs";
import { validateMetaPixelId } from "./validators.mjs";
import {
  normalizeWebsiteDomain,
  parseEnvFile,
} from "../core/config-compiler.mjs";
import { compiledDir } from "../core/types.mjs";
function value(name) {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}
export function readCompiledManagedValues(environment = "production") {
  const walletEnv = join(compiledDir(environment), "wallet.env");
  if (!existsSync(walletEnv))
    throw new Error(
      `Missing ${walletEnv}. Run ./deploy.sh production --dry-run first.`,
    );
  const values = parseEnvFile(walletEnv);
  const domain = values.WEBSITE_DOMAIN?.trim();
  const pixel = values.META_PIXEL_ID?.trim();
  if (!domain || !pixel)
    throw new Error(
      `${walletEnv} must contain WEBSITE_DOMAIN and META_PIXEL_ID from the last compile`,
    );
  return { domain, pixel };
}
export async function migrateInit({
  environment = value("--environment") ?? "production",
  domain = value("--domain"),
  pixel = value("--pixel"),
  actor = value("--actor"),
  source = value("--source") ?? "MIGRATION",
  fromCompiled = process.argv.includes("--from-compiled"),
} = {}) {
  if (runtimeStateExists(environment))
    throw new Error("Runtime state already exists; refusing to overwrite it");
  if (fromCompiled) {
    const compiled = readCompiledManagedValues(environment);
    domain ??= compiled.domain;
    pixel ??= compiled.pixel;
  }
  if (!domain || !pixel || !actor)
    throw new Error(
      "init requires --actor and either --domain/--pixel or --from-compiled; platform.env is never read implicitly",
    );
  const now = new Date().toISOString(),
    changeId = allocateChangeId(() => new Date(), environment);
  const state = {
    schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
    environment,
    WEBSITE_DOMAIN: normalizeWebsiteDomain(domain),
    META_PIXEL_ID: validateMetaPixelId(pixel),
    lastChangeId: changeId,
    lastUpdatedAt: now,
    lastUpdatedBy: actor,
    lastSource: source,
  };
  writeRuntimeState(environment, state);
  appendAuditRecord(environment, {
    changeId,
    key: "MIGRATION",
    priorValue: null,
    requestedValue: null,
    finalValue: null,
    actor,
    source,
    startedAt: now,
    completedAt: now,
    phase: "complete",
    result: "SUCCESS",
    events: [],
    error: null,
  });
  return state;
}
if (import.meta.url === `file://${process.argv[1]}`)
  migrateInit()
    .then(() =>
      console.log(
        "Runtime state initialized. Verify it, then empty WEBSITE_DOMAIN and META_PIXEL_ID in config/platform.env.",
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
