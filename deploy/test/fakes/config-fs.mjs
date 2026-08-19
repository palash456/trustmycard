import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export function withConfigTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "tmc-config-"));
  const previous = process.env.TMC_RUNTIME_CONFIG_DIR;
  process.env.TMC_RUNTIME_CONFIG_DIR = dir;
  return Promise.resolve(fn(dir)).finally(() => {
    if (previous === undefined) delete process.env.TMC_RUNTIME_CONFIG_DIR;
    else process.env.TMC_RUNTIME_CONFIG_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  });
}
