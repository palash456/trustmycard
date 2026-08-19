import {
  getEnvFromCookies,
  isProductionEnvFromCookies,
  type CookieGetter,
  type LogEnv,
} from "./log-env-cookie";
import { deriveProductionApiUrl, getLocalDevBackendUrl } from "./admin-env";
import {
  isLocalAdminDevelopment,
  isLiveAdminPanel,
  isProductionLogSourceEnabled,
} from "./local-dev-policy";

export type AdminBackendConfig = {
  baseUrl: string;
  apiKey: string;
  env: LogEnv;
};

function normalizeBaseUrl(url: string | undefined, fallback: string): string {
  return url?.replace(/\/$/, "") || fallback;
}

function withEnv(
  baseUrl: string,
  apiKey: string,
  env: LogEnv,
): AdminBackendConfig {
  return { baseUrl, apiKey, env };
}

export function getDefaultAdminBackend(): AdminBackendConfig {
  return withEnv(
    getLocalDevBackendUrl(),
    process.env.ADMIN_API_KEY?.trim() ?? "",
    "dev",
  );
}

export function getDevBackend(): AdminBackendConfig {
  return getDefaultAdminBackend();
}

export function getProductionBackend(): AdminBackendConfig | null {
  if (isLocalAdminDevelopment() && !isProductionLogSourceEnabled()) {
    return null;
  }

  if (isLiveAdminPanel()) {
    const baseUrl = process.env.BACKEND_API_URL?.trim();
    const apiKey = process.env.ADMIN_API_KEY?.trim();
    if (!baseUrl || !apiKey) return null;
    return withEnv(normalizeBaseUrl(baseUrl, baseUrl), apiKey, "production");
  }

  const baseUrl = deriveProductionApiUrl();
  const apiKey = process.env.PRODUCTION_ADMIN_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return withEnv(baseUrl, apiKey, "production");
}

export function isProductionBackendConfigured(): boolean {
  if (isLiveAdminPanel()) {
    return Boolean(
      process.env.BACKEND_API_URL?.trim() && process.env.ADMIN_API_KEY?.trim(),
    );
  }
  return getProductionBackend() !== null;
}

export function getActiveEnv(getter?: CookieGetter): LogEnv {
  if (isLiveAdminPanel()) return "production";
  if (!isProductionBackendConfigured()) return "dev";
  if (!getter) return "dev";
  return getEnvFromCookies(getter);
}

export function describeAdminBackend(backend: AdminBackendConfig): string {
  return backend.env === "production" ? "production backend" : "local backend";
}

export function backendUnreachableHint(backend: AdminBackendConfig): string {
  if (backend.env === "dev" && isLocalAdminDevelopment()) {
    return " Start dependencies with: cd backend && npm run dev:deps — then npm run start:dev";
  }
  if (backend.env === "dev") {
    return " Check BACKEND_API_URL is correct and the API is reachable.";
  }
  return " Check that the production API is reachable and PRODUCTION_ADMIN_API_KEY is correct.";
}

export function resolveActiveBackend(
  getter?: CookieGetter,
): AdminBackendConfig {
  if (isLiveAdminPanel()) {
    const production = getProductionBackend();
    if (production) return production;
    return getDevBackend();
  }

  if (
    getter &&
    isProductionLogSourceEnabled() &&
    isProductionEnvFromCookies(getter)
  ) {
    const production = getProductionBackend();
    if (production) return production;
  }
  return getDevBackend();
}

/** Paths that must always hit the local backend (dev tools, test runner). */
export function isLocalOnlyAdminPath(path: string[]): boolean {
  if (path.length === 0) return false;
  if (path[0] === "developer-tests") return true;
  if (path[0] === "dev") return true;
  return false;
}

export function resolveProxyBackend(
  getter: CookieGetter,
  path: string[],
): AdminBackendConfig {
  if (isLocalOnlyAdminPath(path)) return getDevBackend();
  return resolveActiveBackend(getter);
}

export {
  isLocalAdminDevelopment,
  isLiveAdminPanel,
  isProductionLogSourceEnabled,
} from "./local-dev-policy";
