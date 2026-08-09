export function resolveApiUrl(
  apiBaseUrl: string | undefined,
  path: string,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = (apiBaseUrl ?? "").replace(/\/$/, "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
