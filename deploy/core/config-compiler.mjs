import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { manifestExamplePath, manifestPath, repoRoot } from "./types.mjs";

function joinProfile(environment) {
  return `${repoRoot}/env/profiles/${environment}`;
}

export function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Neon pooled hosts use `-pooler`; Prisma interactive transactions need the direct host. */
function neonDirectDatabaseUrl(databaseUrl) {
  const trimmed = databaseUrl?.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/-pooler(?=\.)/, "");
}

export function loadManifest(environment) {
  const primary = manifestPath(environment);
  const example = manifestExamplePath(environment);
  const path = existsSync(primary) ? primary : example;
  if (!existsSync(path)) {
    throw new Error(
      `Missing deploy manifest. Copy ${example} to ${primary} and edit.`,
    );
  }
  const usingExample = path === example;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  return { manifest, usingExample, path };
}

export function loadProfileEnv(environment) {
  const profileDir = joinProfile(environment);
  const files = {
    platform: join(profileDir, "platform.env"),
    backendBudget: join(profileDir, "backend-budget.env"),
    backendApi: join(profileDir, "backend-api.env"),
    backendWorker: join(profileDir, "backend-worker.env"),
    website: join(profileDir, "website.env"),
    admin: join(profileDir, "admin.env"),
  };
  const merged = {};
  for (const [key, file] of Object.entries(files)) {
    merged[key] = parseEnvFile(file);
    merged[key]._path = file;
  }
  return merged;
}

function stripTrailingSlash(url) {
  return String(url ?? "").replace(/\/$/, "");
}

function ensureSecret(map, key, fallback) {
  if (map[key]?.trim()) return map[key].trim();
  if (fallback) return fallback;
  return "";
}

/** Overlay profile keys without blank placeholders wiping platform.env values. */
function mergeNonEmpty(base, overlay) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (key === "_path") continue;
    if (value === "" || value === undefined) continue;
    result[key] = value;
  }
  return result;
}

/** config/platform.env first, then env/profiles/$TMC_ENV/platform.env (same order as load-env.mjs). */
function loadMergedPlatform(profilePlatform) {
  const configPlatform = parseEnvFile(join(repoRoot, "config/platform.env"));
  return mergeNonEmpty(configPlatform, profilePlatform);
}

export function compileEnvBundles(ctx) {
  const { manifest, environment, options } = ctx;
  const profile = loadProfileEnv(environment);
  const platform = loadMergedPlatform(profile.platform);
  const {
    META_PIXEL_ID: _metaPixel,
    META_PIXEL_APP_URL: _metaPixelAppUrl,
    ...platformBackend
  } = platform;
  const website = { ...profile.website };
  const admin = { ...profile.admin };

  const domains = manifest.domains ?? {};
  const walletOrigin = stripTrailingSlash(domains.wallet);
  const apiOrigin = stripTrailingSlash(domains.api);
  const adminOrigin = stripTrailingSlash(domains.admin);
  const internalApiUrl =
    manifest.topology === "micro" ||
    (options?.provider === "local" && manifest.data?.mode === "bundled")
      ? "http://backend:4000"
      : apiOrigin;

  const bundled = manifest.data?.bundled ?? {};
  const pgUser = bundled.postgres_user ?? "trustmycard";
  const pgPass = bundled.postgres_password ?? "trustmycard_local_deploy";
  const pgDb = bundled.postgres_db ?? "trustmycard";

  let databaseUrl = "";
  let redisUrl = "";
  if (manifest.data?.mode === "bundled") {
    databaseUrl = `postgresql://${pgUser}:${pgPass}@postgres:5432/${pgDb}?schema=public`;
    redisUrl = "redis://redis:6379/0";
  } else {
    databaseUrl =
      profile.backendBudget.DATABASE_URL ||
      profile.backendApi.DATABASE_URL ||
      profile.backendWorker.DATABASE_URL ||
      "";
    redisUrl =
      profile.backendBudget.REDIS_URL ||
      profile.backendApi.REDIS_URL ||
      profile.backendWorker.REDIS_URL ||
      "";
  }

  const directDatabaseUrl =
    profile.backendBudget.DIRECT_DATABASE_URL?.trim() ||
    profile.backendApi.DIRECT_DATABASE_URL?.trim() ||
    profile.backendWorker.DIRECT_DATABASE_URL?.trim() ||
    neonDirectDatabaseUrl(databaseUrl) ||
    databaseUrl;

  const adminApiKey = ensureSecret(
    profile.backendBudget,
    "ADMIN_API_KEY",
    ensureSecret(profile.backendApi, "ADMIN_API_KEY", "tmc-local-admin-key"),
  );

  const adminSessionSecret = ensureSecret(
    admin,
    "ADMIN_SESSION_SECRET",
    "tmc-local-admin-session-secret-change-me",
  );

  const commonBackend = {
    ...platformBackend,
    NODE_ENV: "production",
    TMC_ENV: environment,
    DATABASE_URL: databaseUrl,
    DIRECT_DATABASE_URL: directDatabaseUrl,
    REDIS_URL: redisUrl,
    PORT: "4000",
    LOG_LEVEL: profile.backendBudget.LOG_LEVEL || "info",
    ADMIN_API_KEY: adminApiKey,
    APP_ORIGIN: walletOrigin,
    ADMIN_ORIGIN: adminOrigin,
    SWAGGER_ENABLED: "false",
  };

  const budgetBackend = {
    ...mergeNonEmpty(commonBackend, profile.backendBudget),
    SERVICE_ROLE: "all",
    COLLECTION_SIGNING_ENABLED: "true",
    COLLECTION_WORKERS_ENABLED: "false",
    COLLECTION_DISPATCH_MODE: "poll",
    BUDGET_COMBINED_BACKEND: "true",
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    APP_ORIGIN: walletOrigin,
    ADMIN_ORIGIN: adminOrigin,
    ADMIN_API_KEY: adminApiKey,
  };

  const apiEnv = {
    ...mergeNonEmpty(commonBackend, profile.backendApi),
    SERVICE_ROLE: "api",
    COLLECTION_SIGNING_ENABLED: "false",
    COLLECTION_WORKERS_ENABLED: "false",
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    APP_ORIGIN: walletOrigin,
    ADMIN_ORIGIN: adminOrigin,
    ADMIN_API_KEY: adminApiKey,
  };
  delete apiEnv.ADMIN_EVM_PRIVATE_KEY;
  delete apiEnv.ADMIN_TRON_PRIVATE_KEY;

  const workerEnv = {
    ...mergeNonEmpty(commonBackend, profile.backendWorker),
    SERVICE_ROLE: "worker",
    COLLECTION_SIGNING_ENABLED: "true",
    COLLECTION_WORKERS_ENABLED: "true",
    COLLECTION_DISPATCH_MODE: "queue",
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
  };
  delete workerEnv.PORT;

  const walletEnv = {
    ...mergeNonEmpty(platform, website),
    NODE_ENV: "production",
    TMC_ENV: environment,
    BACKEND_API_URL: internalApiUrl,
    NEXT_PUBLIC_APP_URL: walletOrigin,
    NEXT_PUBLIC_PROJECT_ID:
      website.NEXT_PUBLIC_PROJECT_ID?.trim() ||
      platform.NEXT_PUBLIC_PROJECT_ID?.trim() ||
      "",
    META_PIXEL_ID:
      environment === "production"
        ? platform.META_PIXEL_ID || website.META_PIXEL_ID || ""
        : "",
    META_PIXEL_APP_URL:
      environment === "production"
        ? platform.META_PIXEL_APP_URL || ""
        : "",
  };

  const adminEnv = {
    ...mergeNonEmpty({}, admin),
    NODE_ENV: "production",
    TMC_ENV: environment,
    BACKEND_API_URL: internalApiUrl,
    ADMIN_API_KEY: adminApiKey,
    ADMIN_SESSION_SECRET: adminSessionSecret,
    ADMIN_PANEL_PASSWORD:
      admin.ADMIN_PANEL_PASSWORD || "change-me-local-admin",
  };

  const marketingBuildEnv = {
    ...mergeNonEmpty({}, website),
    NODE_ENV: "production",
    TMC_ENV: environment,
    NEXT_PUBLIC_APP_URL: walletOrigin,
  };

  const bundles = {
    backend: budgetBackend,
    api: apiEnv,
    worker: workerEnv,
    wallet: walletEnv,
    admin: adminEnv,
    marketing: marketingBuildEnv,
  };

  if (options?.provider === "local" && manifest.data?.mode === "bundled") {
    for (const bundle of Object.values(bundles)) {
      if (bundle.COLLECTOR_ENABLED === "true" && !bundle.ADMIN_EVM_PRIVATE_KEY) {
        bundle.COLLECTOR_ENABLED = "false";
      }
      if (
        bundle.RESOURCE_SPONSOR_ENABLED === "true" &&
        !bundle.TRON_ENERGY_DELEGATOR_PRIVATE_KEY
      ) {
        bundle.RESOURCE_SPONSOR_ENABLED = "false";
      }
    }
  }

  return {
    bundles,
    meta: {
      databaseUrl,
      redisUrl,
      dataMode: manifest.data?.mode ?? "bundled",
      profilePaths: Object.fromEntries(
        Object.entries(profile).map(([k, v]) => [k, v._path]),
      ),
    },
  };
}
