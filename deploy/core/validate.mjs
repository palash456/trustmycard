import { existsSync } from "fs";
import { join } from "path";
import {
  COMPONENTS,
  DATA_MODES,
  PROVIDERS,
  TOPOLOGIES,
  repoRoot,
} from "./types.mjs";
import { loadProfileEnv } from "./config-compiler.mjs";

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

  for (const key of ["wallet", "api", "admin", "marketing"]) {
    if (!manifest.domains?.[key]) {
      errors.push(`manifest.domains.${key} is required`);
    }
  }

  const profile = loadProfileEnv(environment);
  const configPlatformPath = join(repoRoot, "config/platform.env");
  if (!existsSync(configPlatformPath)) {
    errors.push(
      `Missing ${configPlatformPath} — copy from config/platform.env.example`,
    );
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
