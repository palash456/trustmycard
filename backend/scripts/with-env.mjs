import { config } from "dotenv";
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");

for (const name of [".env", ".env.local"]) {
  const path = resolve(root, name);
  if (existsSync(path)) {
    config({ path, override: name === ".env.local" });
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
}

const [cmd, ...cmdArgs] = args;
const result = spawnSync(cmd, cmdArgs, {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: root,
});

process.exit(result.status ?? 1);
