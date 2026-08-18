import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const configDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(configDir, "..");

/** Resolve dotenv from frontend or backend install (wallet/marketing builds do not install backend). */
function requireDotenv() {
  const bases = [
    resolve(repoRoot, "frontend/package.json"),
    resolve(repoRoot, "backend/package.json"),
  ];
  let lastError;
  for (const base of bases) {
    try {
      const require = createRequire(base);
      return require("dotenv");
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    "[trustmycard] Cannot find the dotenv package. Install it in frontend/ or backend/.",
    { cause: lastError },
  );
}

const { config, parse } = requireDotenv();

const VALID_ENVS = ["development", "production"];

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
  marketing: {
    cwd: resolve(repoRoot, "frontend/marketing"),
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
      `[trustmycard] Unknown TMC_ENV="${raw}", falling back to "development"`,
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
  if (!override) {
    config({ path, override: false });
    return true;
  }
  // Profile overlays fill missing keys only — never stomp Render/host secrets.
  const parsed = parse(readFileSync(path));
  for (const [key, value] of Object.entries(parsed)) {
    const current = process.env[key];
    if (current === undefined || current === "") {
      process.env[key] = value;
    }
  }
  return true;
}

/**
 * Load platform + app env for the given service.
 *
 * Load order (later overrides earlier):
 * 1. config/platform.env (platform-wide wallets, flags, collector, …)
 * 2. app legacy .env / .env.local
 * 3. env/profiles/$TMC_ENV/${app}.env (profile, if present; marketing shares website.env)
 *
 * Legacy-only setups behave exactly as before. Profile files fill gaps; host env wins.
 *
 * @param {"backend" | "website" | "marketing" | "admin"} app
 * @returns {string} resolved TMC_ENV
 */
export function loadTmcEnv(app) {
  if (!LEGACY_APP_PATHS[app]) {
    throw new Error(
      `loadTmcEnv: invalid app "${app}" (expected backend, website, marketing, or admin)`,
    );
  }

  const tmcEnv = getTmcEnv();
  const profileDir = resolve(repoRoot, "env/profiles", tmcEnv);

  loadEnvFile(resolve(repoRoot, "config/platform.env"), false);

  const legacy = LEGACY_APP_PATHS[app];
  for (const name of legacy.files) {
    loadEnvFile(resolve(legacy.cwd, name), name === ".env.local");
  }
  const profileApp = app === "marketing" ? "website" : app;
  loadEnvFile(resolve(profileDir, `${profileApp}.env`), true);

  // Role-specific backend overlays (production split deploy)
  if (app === "backend") {
    const role = (process.env.SERVICE_ROLE ?? "").trim().toLowerCase();
    if (role === "api") {
      loadEnvFile(resolve(profileDir, "backend-api.env"), true);
    } else if (role === "worker") {
      loadEnvFile(resolve(profileDir, "backend-worker.env"), true);
    }
  }

  if (!process.env.TMC_ENV) {
    process.env.TMC_ENV = tmcEnv;
  }

  return tmcEnv;
}
