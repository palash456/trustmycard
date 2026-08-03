import { createRequire } from "module";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const configDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(configDir, "..");

const require = createRequire(resolve(repoRoot, "backend/package.json"));
const { config } = require("dotenv");

const VALID_ENVS = ["development", "production-preview", "production"];

/** @type {Record<string, { cwd: string; files: string[] }>} */
const LEGACY_APP_PATHS = {
  backend: {
    cwd: resolve(repoRoot, "backend"),
    files: [".env", ".env.local"],
  },
  website: {
    cwd: resolve(repoRoot, "frontend/website"),
    files: [".env", ".env.local"],
  },
  admin: {
    cwd: resolve(repoRoot, "frontend/admin"),
    files: [".env", ".env.local"],
  },
};

/**
 * Active Trust My Card environment (set explicitly via npm scripts or PM2).
 * @returns {string}
 */
export function getTmcEnv() {
  const raw = process.env.TMC_ENV || "development";
  if (!VALID_ENVS.includes(raw)) {
    console.warn(
      `[trustmycard] Unknown TMC_ENV="${raw}", falling back to "development"`
    );
    return "development";
  }
  return raw;
}

/**
 * @param {string} path
 * @param {boolean} override
 */
function loadEnvFile(path, override) {
  if (!existsSync(path)) return false;
  config({ path, override });
  return true;
}

/**
 * Load platform + app env for the given service.
 *
 * Load order (later overrides earlier):
 * 1. config/platform.env (legacy)
 * 2. env/profiles/$TMC_ENV/platform.env (profile, if present)
 * 3. app legacy .env / .env.local
 * 4. env/profiles/$TMC_ENV/${app}.env (profile, if present)
 *
 * Legacy-only setups behave exactly as before. Profile files override for isolation.
 *
 * @param {"backend" | "website" | "admin"} app
 * @returns {string} resolved TMC_ENV
 */
export function loadTmcEnv(app) {
  if (!LEGACY_APP_PATHS[app]) {
    throw new Error(
      `loadTmcEnv: invalid app "${app}" (expected backend, website, or admin)`
    );
  }

  const tmcEnv = getTmcEnv();
  const profileDir = resolve(repoRoot, "env/profiles", tmcEnv);

  loadEnvFile(resolve(repoRoot, "config/platform.env"), false);
  loadEnvFile(resolve(profileDir, "platform.env"), true);

  const legacy = LEGACY_APP_PATHS[app];
  for (const name of legacy.files) {
    loadEnvFile(resolve(legacy.cwd, name), name === ".env.local");
  }
  loadEnvFile(resolve(profileDir, `${app}.env`), true);

  if (!process.env.TMC_ENV) {
    process.env.TMC_ENV = tmcEnv;
  }

  return tmcEnv;
}
