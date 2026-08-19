import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  COMPONENTS,
  DATA_MODES,
  PROVIDERS,
  TOPOLOGIES,
  repoRoot,
} from "./types.mjs";
import {
  loadProfileEnv,
  normalizeWebsiteDomain,
  parseEnvFile,
} from "./config-compiler.mjs";
import {
  runtimeStateExists,
  readRuntimeState,
} from "../config-engine/runtime-state.mjs";
import { assertPlatformPlaceholdersEmpty } from "../config-engine/validators.mjs";

export function validateDeployContext(ctx) {
  const errors = [];
  const { manifest, environment, options } = ctx;

  if (!TOPOLOGIES.includes(manifest.topology)) {
    errors.push(`Invalid topology "${manifest.topology}"`);
  }
  const provider = options.provider ?? manifest.provider ?? "local";
  if (!PROVIDERS.includes(provider)) {
    errors.push(`Invalid provider "${provider}"`);
  }
  if (!DATA_MODES.includes(manifest.data?.mode ?? "bundled")) {
    errors.push(`Invalid data.mode "${manifest.data?.mode}"`);
  }

  if (environment !== "production") {
    for (const key of ["wallet", "api", "admin", "marketing"]) {
      if (!manifest.domains?.[key]) {
        errors.push(`manifest.domains.${key} is required`);
      }
    }
  }

  const profile = loadProfileEnv(environment);
  const configPlatformPath = join(repoRoot, "config/platform.env");
  if (!existsSync(configPlatformPath)) {
    errors.push(
      `Missing ${configPlatformPath} — copy from config/platform.env.example`,
    );
  }

  if (environment === "production" && existsSync(configPlatformPath)) {
    try {
      if (runtimeStateExists(environment)) {
        assertPlatformPlaceholdersEmpty(repoRoot);
        const state = readRuntimeState(environment);
        normalizeWebsiteDomain(state.WEBSITE_DOMAIN);
      } else {
        const platform = parseEnvFile(configPlatformPath);
        if (!platform.WEBSITE_DOMAIN?.trim()) {
          errors.push(
            "Production runtime state is missing and WEBSITE_DOMAIN placeholder is empty. Run scripts/config-update.sh init first.",
          );
        } else {
          normalizeWebsiteDomain(platform.WEBSITE_DOMAIN);
        }
      }
    } catch (error) {
      errors.push(`config/platform.env: ${error.message}`);
    }
    const forbiddenPlatformKeys = ["APEX_DOMAIN", "META_PIXEL_APP_URL"];
    const platformText = readFileSync(configPlatformPath, "utf8");
    for (const key of forbiddenPlatformKeys) {
      if (new RegExp(`^${key}=`, "m").test(platformText)) {
        errors.push(
          `config/platform.env: ${key} must be compiler-derived or removed`,
        );
      }
    }
    const derivedProfileKeys = {
      backend: ["APP_ORIGIN"],
      website: ["BACKEND_API_URL", "NEXT_PUBLIC_APP_URL"],
      admin: ["BACKEND_API_URL", "PRODUCTION_BACKEND_API_URL"],
    };
    for (const [name, keys] of Object.entries(derivedProfileKeys)) {
      for (const key of keys) {
        if (profile[name][key]) {
          errors.push(`${name}.env: ${key} is derived from WEBSITE_DOMAIN`);
        }
      }
    }
    const caddyTemplatePath = join(repoRoot, "deploy/caddy/Caddyfile");
    if (existsSync(caddyTemplatePath)) {
      const manualHost = readFileSync(caddyTemplatePath, "utf8")
        .split("\n")
        .find((line) => /^\s*(?!\{\{)[^#\s].*\{\s*$/.test(line));
      if (manualHost) {
        errors.push(
          `deploy/caddy/Caddyfile: manually maintained hostname "${manualHost.trim()}"`,
        );
      }
    }
  }

  if (manifest.topology === "micro") {
    const dataMode = manifest.data?.mode ?? "bundled";
    if (dataMode !== "external" && provider !== "local") {
      errors.push(
        'topology "micro" on a VPS requires data.mode=external (Neon Postgres + Upstash Redis) — bundled DB does not fit a 512 MB VPS',
      );
    }
    if (!existsSync(profile.backend._path) && provider !== "local") {
      errors.push(
        `Missing ${profile.backend._path} — copy from backend.env.example`,
      );
    }
    if (dataMode === "external") {
      const databaseUrl = profile.backend.DATABASE_URL?.trim();
      const redisUrl = profile.backend.REDIS_URL?.trim();
      if (!databaseUrl) {
        errors.push(
          "backend.env: DATABASE_URL is required for micro + external data",
        );
      } else if (
        databaseUrl.includes("USER:PASSWORD") ||
        databaseUrl.includes("@HOST")
      ) {
        errors.push(
          "backend.env: DATABASE_URL is still a placeholder — paste your Neon connection string",
        );
      }
      if (!redisUrl) {
        errors.push(
          "backend.env: REDIS_URL is required for micro + external data",
        );
      } else if (redisUrl.includes("PASSWORD@HOST")) {
        errors.push(
          "backend.env: REDIS_URL is still a placeholder — paste your Upstash rediss:// URL",
        );
      }
    }
  }

  if (manifest.topology === "budget" && !existsSync(profile.backend._path)) {
    if (provider !== "local") {
      errors.push(
        `Missing ${profile.backend._path} — copy from backend.env.example`,
      );
    }
  }
  if (manifest.topology === "full") {
    if (!existsSync(profile.backendApi._path)) {
      errors.push(`Missing ${profile.backendApi._path}`);
    }
    if (!existsSync(profile.backendWorker._path)) {
      errors.push(`Missing ${profile.backendWorker._path}`);
    }
  }

  const requiredComponents = COMPONENTS[manifest.topology] ?? [];
  for (const component of requiredComponents) {
    if (component === "marketing") continue;
    if (
      component === "wallet" &&
      !existsSync(profile.website._path) &&
      provider !== "local"
    ) {
      errors.push(`Missing ${profile.website._path}`);
    }
    if (
      component === "admin" &&
      !existsSync(profile.admin._path) &&
      provider !== "local"
    ) {
      errors.push(`Missing ${profile.admin._path}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Deploy validation failed:\n- ${errors.join("\n- ")}`);
  }

  const projectId = profile.website.NEXT_PUBLIC_PROJECT_ID?.trim();
  if (!projectId) {
    console.warn(
      "[deploy] website.env: NEXT_PUBLIC_PROJECT_ID is empty — Issue Card / wallet connect will not work until set (https://cloud.walletconnect.com). Rebuild the wallet image after adding it.",
    );
  }

  return { provider };
}
