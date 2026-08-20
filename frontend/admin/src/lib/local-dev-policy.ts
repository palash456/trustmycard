/** Local admin panel: dev backend only unless production logs are explicitly enabled. */

export function isLocalAdminDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Deployed admin (e.g. Vercel) — never show Development data source. */
export function isLiveAdminPanel(): boolean {
  return !isLocalAdminDevelopment();
}

export function isMonitoringAdminPath(pathname: string): boolean {
  return (
    pathname.startsWith("/audit") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/events")
  );
}
