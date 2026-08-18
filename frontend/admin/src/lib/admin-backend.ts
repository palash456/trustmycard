import {
  getEnvFromCookies,
  isProductionEnvFromCookies,
  type CookieGetter,
  type LogEnv,
} from "./log-env-cookie";
import {
  isLocalAdminDevelopment,
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
    normalizeBaseUrl(process.env.BACKEND_API_URL, "http://127.0.0.1:4000"),
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
  const baseUrl = process.env.PRODUCTION_BACKEND_API_URL?.trim();
  const apiKey = process.env.PRODUCTION_ADMIN_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return withEnv(normalizeBaseUrl(baseUrl, baseUrl), apiKey, "production");
}

export function isProductionBackendConfigured(): boolean {
  return getProductionBackend() !== null;
}

export function getActiveEnv(getter?: CookieGetter): LogEnv {
  if (!isProductionBackendConfigured()) return "dev";
  if (!getter) return "dev";
  return getEnvFromCookies(getter);
}

export function describeAdminBackend(backend: AdminBackendConfig): string {
  return backend.env === "production" ? "production backend" : "local backend";
}

export function backendUnreachableHint(backend: AdminBackendConfig): string {
  if (backend.env === "dev") {
    return " Start dependencies with: cd backend && npm run dev:deps — then npm run start:dev";
  }
  return " Check that the production API is reachable and PRODUCTION_ADMIN_API_KEY is correct.";
}

export function resolveActiveBackend(
  getter?: CookieGetter,
): AdminBackendConfig {
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

export { isLocalAdminDevelopment, isProductionLogSourceEnabled } from "./local-dev-policy";
