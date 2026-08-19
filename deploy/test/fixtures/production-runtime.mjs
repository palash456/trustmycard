import { RUNTIME_STATE_SCHEMA_VERSION } from "../../config-engine/constants.mjs";
import { writeRuntimeState } from "../../config-engine/runtime-state.mjs";

export const PRODUCTION_RUNTIME_FIXTURE = {
  schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
  environment: "production",
  WEBSITE_DOMAIN: "mytrustvisa.cards",
  META_PIXEL_ID: "2158981564683913",
  lastChangeId: "CFG-20260819-000001",
  lastUpdatedAt: "2026-08-19T00:00:00.000Z",
  lastUpdatedBy: "test@host",
  lastSource: "TEST",
};

export function withProductionRuntime(fn) {
  const prior = process.env.TMC_RUNTIME_CONFIG_DIR;
  const dir = `${process.cwd()}/deploy/runtime-config`;
  process.env.TMC_RUNTIME_CONFIG_DIR = dir;
  writeRuntimeState("production", PRODUCTION_RUNTIME_FIXTURE);
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = prior;
  }
}
