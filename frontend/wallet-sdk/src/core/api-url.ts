export function resolveApiUrl(apiBaseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = apiBaseUrl.replace(/\/$/, "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
