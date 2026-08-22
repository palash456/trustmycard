export const RUNTIME_STATE_SCHEMA_VERSION = 1;
export const MANAGED_KEYS = ["WEBSITE_DOMAIN", "META_PIXEL_ID"];
export const EVENT_PHASES = [
  "read",
  "validation",
  "preflight",
  "apply",
  "restart",
  "verify",
  "rollback",
  "log",
  "complete",
];
