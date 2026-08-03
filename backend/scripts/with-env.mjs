import { spawnSync } from "child_process";
import { resolve } from "path";
import { loadTmcEnv } from "../../config/load-env.mjs";

const root = resolve(import.meta.dirname, "..");

const tmcEnv = loadTmcEnv("backend");
console.log(`[trustmycard] TMC_ENV=${tmcEnv}`);

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
