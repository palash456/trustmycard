/** Local admin panel: dev backend only unless production logs are explicitly enabled. */

export function isLocalAdminDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Production data source: opt-in flag or explicit PRODUCTION_* credentials in admin env. */
export function isProductionLogSourceEnabled(): boolean {
  if (process.env.ADMIN_ALLOW_PRODUCTION_LOGS === "true") return true;
  const baseUrl = process.env.PRODUCTION_BACKEND_API_URL?.trim();
  const apiKey = process.env.PRODUCTION_ADMIN_API_KEY?.trim();
  return Boolean(baseUrl && apiKey);
}

export function isMonitoringAdminPath(pathname: string): boolean {
  return (
    pathname.startsWith("/audit") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/events")
  );
}
