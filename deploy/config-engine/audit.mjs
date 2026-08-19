import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { auditLogPath, runtimeConfigDir } from "./paths.mjs";
import { assertAuditRecord } from "./schemas.mjs";
export function appendAuditRecord(environment, record) {
  assertAuditRecord(record);
  const dir = runtimeConfigDir(environment);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const path = auditLogPath(environment);
  appendFileSync(path, `${JSON.stringify(record)}\n`, { mode: 0o640 });
  chmodSync(path, 0o640);
}
export function readAuditHistory(environment, { limit = 50 } = {}) {
  const path = auditLogPath(environment);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse)
    .slice(-Math.max(0, Number(limit) || 50))
    .reverse();
}
