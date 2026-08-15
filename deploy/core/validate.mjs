import { existsSync } from "fs";
import { COMPONENTS, DATA_MODES, PROVIDERS, TOPOLOGIES } from "./types.mjs";
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
  if (!existsSync(profile.platform._path)) {
    errors.push(
      `Missing ${profile.platform._path} — copy from platform.env.example`,
    );
  }

  if (manifest.topology === "micro") {
    if ((manifest.data?.mode ?? "bundled") !== "external") {
      errors.push(
        'topology "micro" requires data.mode=external (Neon Postgres + Upstash Redis) — bundled DB does not fit a 512 MB VPS',
      );
    }
    if (!existsSync(profile.backendBudget._path)) {
      errors.push(
        `Missing ${profile.backendBudget._path} — copy from backend-budget.env.example`,
      );
    }
    if (!profile.backendBudget.DATABASE_URL?.trim()) {
      errors.push("backend-budget.env: DATABASE_URL is required for micro topology");
    }
    if (!profile.backendBudget.REDIS_URL?.trim()) {
      errors.push("backend-budget.env: REDIS_URL is required for micro topology");
    }
  }

  if (manifest.topology === "budget" && !existsSync(profile.backendBudget._path)) {
    if (provider !== "local") {
      errors.push(
        `Missing ${profile.backendBudget._path} — copy from backend-budget.env.example`,
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
    if (component === "wallet" && !existsSync(profile.website._path) && provider !== "local") {
      errors.push(`Missing ${profile.website._path}`);
    }
    if (component === "admin" && !existsSync(profile.admin._path) && provider !== "local") {
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
