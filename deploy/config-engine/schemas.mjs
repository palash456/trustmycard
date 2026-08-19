import { MANAGED_KEYS, RUNTIME_STATE_SCHEMA_VERSION } from "./constants.mjs";
export function assertRuntimeState(state, environment) {
  if (!state || typeof state !== "object")
    throw new Error("Runtime state must be an object");
  if (state.schemaVersion !== RUNTIME_STATE_SCHEMA_VERSION)
    throw new Error(`Unsupported runtime state schema: ${state.schemaVersion}`);
  if (state.environment !== environment)
    throw new Error(`Runtime state environment must be ${environment}`);
  for (const key of [
    ...MANAGED_KEYS,
    "lastChangeId",
    "lastUpdatedAt",
    "lastUpdatedBy",
    "lastSource",
  ])
    if (typeof state[key] !== "string" || !state[key])
      throw new Error(`Runtime state ${key} is required`);
  return state;
}
export function assertAuditRecord(record) {
  for (const key of [
    "changeId",
    "key",
    "actor",
    "source",
    "startedAt",
    "phase",
    "result",
  ])
    if (typeof record?.[key] !== "string" || !record[key])
      throw new Error(`Audit record ${key} is required`);
  return record;
}
