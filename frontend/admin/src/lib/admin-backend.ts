import {
  getLogEnvFromCookie,
  isProductionLogEnvFromCookie,
  type LogEnv,
} from "./log-env-cookie";

export type AdminBackendConfig = {
  baseUrl: string;
  apiKey: string;
};

function normalizeBaseUrl(url: string | undefined, fallback: string): string {
  return url?.replace(/\/$/, "") || fallback;
}

export function getDefaultAdminBackend(): AdminBackendConfig {
  return {
    baseUrl: normalizeBaseUrl(process.env.BACKEND_API_URL, "http://127.0.0.1:4000"),
    apiKey: process.env.ADMIN_API_KEY?.trim() ?? "",
  };
}

export function getProductionLogBackend(): AdminBackendConfig | null {
  const baseUrl = process.env.PRODUCTION_BACKEND_API_URL?.trim();
  const apiKey = process.env.PRODUCTION_ADMIN_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: normalizeBaseUrl(baseUrl, baseUrl),
    apiKey,
  };
}

export function isProductionLogBackendConfigured(): boolean {
  return getProductionLogBackend() !== null;
}

export function resolveAdminBackend(
  cookieHeader?: string
): AdminBackendConfig {
  return resolveLogBackend(cookieHeader);
}

export function resolveLogBackend(
  cookieHeader?: string
): AdminBackendConfig {
  if (isProductionLogEnvFromCookie(cookieHeader)) {
    const production = getProductionLogBackend();
    if (production) return production;
  }
  return getDefaultAdminBackend();
}

export function getActiveLogEnv(cookieHeader?: string): LogEnv {
  if (!isProductionLogBackendConfigured()) return "dev";
  return getLogEnvFromCookie(cookieHeader);
}

/** Admin API paths whose data should follow the log environment toggle. */
export function isLogApiPath(path: string[]): boolean {
  if (path.length === 0) return false;
  if (path[0] === "observability") return true;
  if (path[0] === "activity" && path[1] === "feed") return true;
  if (path[0] === "sessions" && path[2] === "timeline") return true;
  if (path[0] === "audit-logs") return true;
  return false;
}
