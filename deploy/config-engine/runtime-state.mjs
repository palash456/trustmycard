import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { runtimeConfigDir, runtimeStatePath } from "./paths.mjs";
import { assertRuntimeState } from "./schemas.mjs";
function ensureDir(environment) {
  const dir = runtimeConfigDir(environment);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  return dir;
}
export function readRuntimeState(environment) {
  const path = runtimeStatePath(environment);
  if (!existsSync(path))
    throw new Error(
      `Runtime state is missing: ${path}. Run config-update init first.`,
    );
  try {
    return assertRuntimeState(
      JSON.parse(readFileSync(path, "utf8")),
      environment,
    );
  } catch (error) {
    throw new Error(`Invalid runtime state ${path}: ${error.message}`);
  }
}
export function writeRuntimeState(environment, state) {
  assertRuntimeState(state, environment);
  ensureDir(environment);
  const path = runtimeStatePath(environment),
    temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
  chmodSync(path, 0o600);
  return path;
}
export function createRollbackSnapshot(state) {
  return structuredClone(state);
}
export function runtimeStateExists(environment) {
  return existsSync(runtimeStatePath(environment));
}
