import { deriveProductionApiUrl } from "./admin-env";

/** Local admin panel: dev backend only unless production logs are explicitly enabled. */

export function isLocalAdminDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Deployed admin (e.g. Vercel) — never show Development data source. */
export function isLiveAdminPanel(): boolean {
  return !isLocalAdminDevelopment();
}

/** Production data source: opt-in flag plus production API URL and admin key. */
export function isProductionLogSourceEnabled(): boolean {
  if (process.env.ADMIN_ALLOW_PRODUCTION_LOGS !== "true") return false;
  const apiKey = process.env.PRODUCTION_ADMIN_API_KEY?.trim();
  if (!apiKey) return false;
  return Boolean(deriveProductionApiUrl());
}

export function isMonitoringAdminPath(pathname: string): boolean {
  return (
    pathname.startsWith("/audit") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/events")
  );
}
