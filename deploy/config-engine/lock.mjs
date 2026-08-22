import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { pid } from "node:process";
import { lockPath, runtimeConfigDir } from "./paths.mjs";

const STALE_LOCK_MS = 120_000;

function readLockMeta(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isLockStale(meta) {
  if (!meta) return true;
  if (Date.now() - Number(meta.createdAt ?? 0) > STALE_LOCK_MS) return true;
  const holderPid = Number(meta.pid);
  if (!Number.isFinite(holderPid) || holderPid <= 0) return false;
  try {
    process.kill(holderPid, 0);
    return false;
  } catch {
    return true;
  }
}

export async function withUpdateLock(environment, fn) {
  mkdirSync(runtimeConfigDir(environment), { recursive: true, mode: 0o700 });
  const path = lockPath(environment);
  try {
    const fd = openSync(path, "wx", 0o600);
    closeSync(fd);
    writeFileSync(
      path,
      JSON.stringify({ createdAt: Date.now(), pid }),
      "utf8",
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (!isLockStale(readLockMeta(path))) {
      throw new Error("A configuration update is already in progress");
    }
    unlinkSync(path);
    return withUpdateLock(environment, fn);
  }
  try {
    return await fn();
  } finally {
    if (existsSync(path)) unlinkSync(path);
  }
}
