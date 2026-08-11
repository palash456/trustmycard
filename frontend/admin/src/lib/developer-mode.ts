export const DEVELOPER_PROTECTED_ROUTE_PREFIXES = [
  "/documentation",
  "/developer-test",
  "/settings",
  "/system",
] as const;

export type DeveloperProtectedPrefix =
  (typeof DEVELOPER_PROTECTED_ROUTE_PREFIXES)[number];

export function getDeveloperProtectedPrefix(
  pathname: string,
): DeveloperProtectedPrefix | null {
  for (const prefix of DEVELOPER_PROTECTED_ROUTE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }
  return null;
}

export function isDeveloperProtectedRoute(pathname: string): boolean {
  return getDeveloperProtectedPrefix(pathname) !== null;
}
