import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RUNTIME_STATE_SCHEMA_VERSION } from "../../config-engine/constants.mjs";
import { writeRuntimeState } from "../../config-engine/runtime-state.mjs";

/** Synthetic values for isolated tests — never real production domain or pixel IDs. */
export const TEST_RUNTIME_DOMAIN = "runtime.test";
export const TEST_RUNTIME_PIXEL_ID = "123456789012345";

export const PRODUCTION_RUNTIME_FIXTURE = {
  schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
  environment: "production",
  WEBSITE_DOMAIN: TEST_RUNTIME_DOMAIN,
  META_PIXEL_ID: TEST_RUNTIME_PIXEL_ID,
  lastChangeId: "CFG-20260819-000001",
  lastUpdatedAt: "2026-08-19T00:00:00.000Z",
  lastUpdatedBy: "test@host",
  lastSource: "TEST",
};

export function withProductionRuntime(fn) {
  const prior = process.env.TMC_RUNTIME_CONFIG_DIR;
  const dir = mkdtempSync(join(tmpdir(), "tmc-runtime-test-"));
  process.env.TMC_RUNTIME_CONFIG_DIR = dir;
  writeRuntimeState("production", PRODUCTION_RUNTIME_FIXTURE);
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = prior;
    rmSync(dir, { recursive: true, force: true });
  }
}
