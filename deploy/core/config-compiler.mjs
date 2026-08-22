import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { manifestExamplePath, manifestPath, repoRoot } from "./types.mjs";
import {
  readRuntimeState,
  runtimeStateExists,
} from "../config-engine/runtime-state.mjs";
import { resolveManagedPlatformValues } from "../config-engine/validators.mjs";

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
    backend: join(profileDir, "backend.env"),
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

export function normalizeWebsiteDomain(value) {
  const domain = String(value ?? "")
    .trim()
    .toLowerCase();
  const hostnamePattern =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!hostnamePattern.test(domain)) {
    throw new Error(
      "WEBSITE_DOMAIN must be a hostname such as exampleDomain.com (not a URL)",
    );
  }
  return domain;
}

export function publicOrigins(environment, manifest, platform) {
  if (environment === "production") {
    const websiteDomain = normalizeWebsiteDomain(platform.WEBSITE_DOMAIN);
    return {
      websiteDomain,
      walletOrigin: `https://${websiteDomain}`,
      wwwOrigin: `https://www.${websiteDomain}`,
      apiOrigin: `https://api.${websiteDomain}`,
      adminOrigin: "http://localhost:3002",
    };
  }

  const domains = manifest.domains ?? {};
  return {
    websiteDomain: "",
    walletOrigin: stripTrailingSlash(domains.wallet),
    wwwOrigin: stripTrailingSlash(domains.marketing),
    apiOrigin: stripTrailingSlash(domains.api),
    adminOrigin: stripTrailingSlash(domains.admin),
  };
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

/** Platform config lives in config/platform.env only (see config/load-env.mjs). */
function loadPlatformEnv() {
  return parseEnvFile(join(repoRoot, "config/platform.env"));
}

function resolveProductionRuntimeState(environment, runtimeState) {
  if (runtimeState) return runtimeState;
  if (environment === "production" && runtimeStateExists(environment)) {
    const state = readRuntimeState(environment);
    return {
      WEBSITE_DOMAIN: state.WEBSITE_DOMAIN,
      META_PIXEL_ID: state.META_PIXEL_ID,
    };
  }
  return null;
}

export function compileEnvBundles(ctx, runtimeState = null) {
  const { manifest, environment, options } = ctx;
  const profile = loadProfileEnv(environment);
  const platform = loadPlatformEnv();
  const resolvedRuntime = resolveProductionRuntimeState(
    environment,
    runtimeState,
  );
  const effectivePlatform =
    environment === "production" && resolvedRuntime
      ? {
          ...platform,
          ...resolveManagedPlatformValues(platform, resolvedRuntime),
        }
      : environment === "production"
        ? {
            ...platform,
            ...resolveManagedPlatformValues(platform, null),
          }
        : platform;
  const {
    WEBSITE_DOMAIN: _websiteDomain,
    META_PIXEL_ID: _metaPixel,
    META_PIXEL_APP_URL: _metaPixelAppUrl,
    ...platformBackend
  } = effectivePlatform;
  const website = { ...profile.website };
  const admin = { ...profile.admin };

  const origins = publicOrigins(environment, manifest, effectivePlatform);
  const { walletOrigin, apiOrigin, adminOrigin } = origins;
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
      profile.backend.DATABASE_URL ||
      profile.backendApi.DATABASE_URL ||
      profile.backendWorker.DATABASE_URL ||
      "";
    redisUrl =
      profile.backend.REDIS_URL ||
      profile.backendApi.REDIS_URL ||
      profile.backendWorker.REDIS_URL ||
      "";
    if (environment === "production") {
      const missing = [];
      if (!databaseUrl?.trim()) {
        missing.push(
          `DATABASE_URL (set in env/profiles/${environment}/backend.env and sync to VPS)`,
        );
      }
      if (!redisUrl?.trim()) {
        missing.push(
          `REDIS_URL (set in env/profiles/${environment}/backend.env and sync to VPS)`,
        );
      }
      if (missing.length > 0) {
        throw new Error(
          `Missing required external data env for ${environment}: ${missing.join(", ")}.`,
        );
      }
    }
  }

  const directDatabaseUrl =
    profile.backend.DIRECT_DATABASE_URL?.trim() ||
    profile.backendApi.DIRECT_DATABASE_URL?.trim() ||
    profile.backendWorker.DIRECT_DATABASE_URL?.trim() ||
    neonDirectDatabaseUrl(databaseUrl) ||
    databaseUrl;

  const adminApiKey = ensureSecret(
    profile.backend,
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
    LOG_LEVEL: profile.backend.LOG_LEVEL || "info",
    ADMIN_API_KEY: adminApiKey,
    APP_ORIGIN: walletOrigin,
    ADMIN_ORIGIN: adminOrigin,
    SWAGGER_ENABLED: "false",
  };

  const budgetBackend = {
    ...mergeNonEmpty(commonBackend, profile.backend),
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
    ...mergeNonEmpty(effectivePlatform, website),
    NODE_ENV: "production",
    TMC_ENV: environment,
    BACKEND_API_URL: internalApiUrl,
    NEXT_PUBLIC_APP_URL: walletOrigin,
    NEXT_PUBLIC_PROJECT_ID:
      website.NEXT_PUBLIC_PROJECT_ID?.trim() ||
      effectivePlatform.NEXT_PUBLIC_PROJECT_ID?.trim() ||
      "",
    META_PIXEL_ID:
      environment === "production"
        ? effectivePlatform.META_PIXEL_ID || website.META_PIXEL_ID || ""
        : "",
    META_PIXEL_APP_URL: environment === "production" ? walletOrigin : "",
    // Expose the bare domain for security.txt canonical URL (derived from walletOrigin).
    NEXT_PUBLIC_WEBSITE_DOMAIN:
      environment === "production" ? origins.websiteDomain : "",
    // Site identity — shown in footer + security.txt. Read from platform.env or profile.
    NEXT_PUBLIC_LEGAL_NAME:
      effectivePlatform.NEXT_PUBLIC_LEGAL_NAME?.trim() ||
      website.NEXT_PUBLIC_LEGAL_NAME?.trim() ||
      "",
    NEXT_PUBLIC_SUPPORT_EMAIL:
      effectivePlatform.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      website.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      "",
    // Server-only — not NEXT_PUBLIC; used by /.well-known/security.txt route.
    PLATFORM_SECURITY_EMAIL:
      effectivePlatform.PLATFORM_SECURITY_EMAIL?.trim() ||
      effectivePlatform.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      "",
  };

  const adminEnv = {
    ...mergeNonEmpty({}, admin),
    NODE_ENV: "production",
    TMC_ENV: environment,
    BACKEND_API_URL: internalApiUrl,
    PRODUCTION_BACKEND_API_URL:
      environment === "production"
        ? apiOrigin
        : admin.PRODUCTION_BACKEND_API_URL || "",
    ADMIN_API_KEY: adminApiKey,
    ADMIN_SESSION_SECRET: adminSessionSecret,
    ADMIN_PANEL_PASSWORD: admin.ADMIN_PANEL_PASSWORD || "change-me-local-admin",
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
      if (
        bundle.COLLECTOR_ENABLED === "true" &&
        !bundle.ADMIN_EVM_PRIVATE_KEY
      ) {
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
      origins,
      profilePaths: Object.fromEntries(
        Object.entries(profile).map(([k, v]) => [k, v._path]),
      ),
    },
  };
}

function isApexWebsiteDomain(websiteDomain) {
  return websiteDomain.split(".").length <= 2;
}

export function compileCaddyfile(websiteDomain) {
  const templatePath = join(repoRoot, "deploy/caddy/Caddyfile");
  const replacements = {
    "{{API_HOST}}": `api.${websiteDomain}`,
    "{{WWW_HOST}}": `www.${websiteDomain}`,
    "{{WEBSITE_DOMAIN}}": websiteDomain,
  };
  let caddyfile = readFileSync(templatePath, "utf8");
  for (const [token, value] of Object.entries(replacements)) {
    caddyfile = caddyfile.replaceAll(token, value);
  }
  if (caddyfile.includes("{{")) {
    throw new Error(`Unresolved Caddyfile template token in ${templatePath}`);
  }
  // Subdomain products (e.g. wallet.example.com) do not use www.{subdomain}; omitting
  // the block avoids endless ACME retries for NXDOMAIN www hostnames.
  if (!isApexWebsiteDomain(websiteDomain)) {
    caddyfile = caddyfile.replace(
      /\n# Permanent apex canonical URL[^\n]*\n[^\n]+\{\n\tredir https:\/\/[^\n]+\n\}\n/,
      "\n",
    );
  }
  return caddyfile;
}
