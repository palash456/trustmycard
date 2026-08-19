import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { lockPath, runtimeConfigDir } from "./paths.mjs";
const STALE_LOCK_MS = 600000;
export async function withUpdateLock(environment, fn) {
  mkdirSync(runtimeConfigDir(environment), { recursive: true, mode: 0o700 });
  const path = lockPath(environment);
  try {
    const fd = openSync(path, "wx", 0o600);
    closeSync(fd);
    writeFileSync(path, JSON.stringify({ createdAt: Date.now() }));
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let stale = false;
    try {
      stale =
        Date.now() - JSON.parse(readFileSync(path, "utf8")).createdAt >
        STALE_LOCK_MS;
    } catch {}
    if (!stale)
      throw new Error("A configuration update is already in progress");
    unlinkSync(path);
    return withUpdateLock(environment, fn);
  }
  try {
    return await fn();
  } finally {
    if (existsSync(path)) unlinkSync(path);
  }
}
