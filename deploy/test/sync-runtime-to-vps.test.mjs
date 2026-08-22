import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { deployRoot } from "../core/types.mjs";
import { shouldSyncRuntimeConfigToVps } from "../config-engine/sync-runtime-to-vps.mjs";

test("shouldSyncRuntimeConfigToVps is false for local provider", () => {
  assert.equal(shouldSyncRuntimeConfigToVps("local", "production"), false);
});

test("shouldSyncRuntimeConfigToVps is false when TMC_CONFIG_DEPLOY_LOCAL=true", () => {
  const prior = process.env.TMC_CONFIG_DEPLOY_LOCAL;
  process.env.TMC_CONFIG_DEPLOY_LOCAL = "true";
  try {
    assert.equal(shouldSyncRuntimeConfigToVps("docker-vps", "production"), false);
  } finally {
    if (prior === undefined) delete process.env.TMC_CONFIG_DEPLOY_LOCAL;
    else process.env.TMC_CONFIG_DEPLOY_LOCAL = prior;
  }
});

test("shouldSyncRuntimeConfigToVps is true for docker-vps with provider credentials", () => {
  const credsPath = join(deployRoot, "provider.credentials.env");
  const priorDeployLocal = process.env.TMC_CONFIG_DEPLOY_LOCAL;
  delete process.env.TMC_CONFIG_DEPLOY_LOCAL;
  try {
    if (!existsSync(credsPath)) return;
    assert.equal(shouldSyncRuntimeConfigToVps("docker-vps", "production"), true);
  } finally {
    if (priorDeployLocal === undefined) delete process.env.TMC_CONFIG_DEPLOY_LOCAL;
    else process.env.TMC_CONFIG_DEPLOY_LOCAL = priorDeployLocal;
  }
});
