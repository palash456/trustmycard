import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "fs";
import { join } from "path";

function runtimeConfigDir(): string {
  if (process.env.TMC_RUNTIME_CONFIG_DIR?.trim()) {
    return process.env.TMC_RUNTIME_CONFIG_DIR.trim();
  }
  const vps = "/opt/tmc/deploy/runtime-config";
  if (existsSync(vps)) return vps;
  const repoRoot = process.env.TMC_REPO_ROOT?.trim();
  if (repoRoot) return join(repoRoot, "deploy/runtime-config");
  return join(__dirname, "../../../../deploy/runtime-config");
}

function auditLogPath(): string {
  return join(runtimeConfigDir(), "audit.ndjson");
}

export function appendProductionConfigAudit(
  record: Record<string, unknown>,
): void {
  const dir = runtimeConfigDir();
  mkdirSync(dir, { recursive: true });
  appendFileSync(auditLogPath(), `${JSON.stringify(record)}\n`, { mode: 0o640 });
}

export function readProductionConfigAudit(
  limit = 50,
): Record<string, unknown>[] {
  const path = auditLogPath();
  if (!existsSync(path)) return [];
  const n = Math.max(1, Math.min(100, limit));
  const lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
  return lines
    .slice(-n)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .reverse();
}
