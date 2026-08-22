import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  localRuntimeConfigDir,
  remoteRuntimeConfigDir,
  runtimeConfigSyncPlan,
} from "../core/runtime-config-sync.mjs";

test("runtimeConfigSyncPlan returns null when local state is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "tmc-runtime-sync-"));
  assert.equal(runtimeConfigSyncPlan("production", dir), null);
});

test("runtimeConfigSyncPlan lists state and optional audit files", () => {
  const dir = mkdtempSync(join(tmpdir(), "tmc-runtime-sync-"));
  const stateFile = join(dir, "production.json");
  writeFileSync(stateFile, '{"schemaVersion":1}\n');
  writeFileSync(join(dir, "audit.ndjson"), '{"changeId":"CFG-test"}\n');

  const plan = runtimeConfigSyncPlan("production", dir);
  assert.ok(plan);
  assert.equal(plan.stateFile, stateFile);
  assert.equal(plan.hasAudit, true);
  assert.equal(plan.remoteStatePath, "production.json");
});

test("remoteRuntimeConfigDir prefers VPS_RUNTIME_CONFIG_DIR", () => {
  const remote = remoteRuntimeConfigDir(
    { VPS_RUNTIME_CONFIG_DIR: "/custom/runtime" },
    "/opt/tmc",
  );
  assert.equal(remote, "/custom/runtime");
});

test("localRuntimeConfigDir uses TMC_RUNTIME_CONFIG_DIR override", () => {
  const prior = process.env.TMC_RUNTIME_CONFIG_DIR;
  process.env.TMC_RUNTIME_CONFIG_DIR = "/tmp/custom-runtime";
  try {
    assert.equal(localRuntimeConfigDir(), "/tmp/custom-runtime");
  } finally {
    if (prior === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = prior;
  }
});
