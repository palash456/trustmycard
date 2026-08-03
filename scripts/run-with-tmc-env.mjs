import { spawnSync } from "child_process";
import { loadTmcEnv, repoRoot } from "../config/load-env.mjs";
import { resolve } from "path";

/** @type {Record<string, string>} */
const APP_CWD = {
  backend: resolve(repoRoot, "backend"),
  website: resolve(repoRoot, "frontend/website"),
  admin: resolve(repoRoot, "frontend/admin"),
};

const [app, ...cmdParts] = process.argv.slice(2);

if (!app || cmdParts.length === 0 || !APP_CWD[app]) {
  console.error(
    "Usage: node scripts/run-with-tmc-env.mjs <backend|website|admin> <command...>"
  );
  process.exit(1);
}

const tmcEnv = loadTmcEnv(app);
console.log(`[trustmycard] TMC_ENV=${tmcEnv} app=${app}`);

const [cmd, ...args] = cmdParts;
const result = spawnSync(cmd, args, {
  cwd: APP_CWD[app],
  stdio: "inherit",
  shell: false,
  env: process.env,
});

process.exit(result.status ?? 1);
