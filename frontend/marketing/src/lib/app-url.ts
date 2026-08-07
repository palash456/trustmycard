const DEFAULT_APP_URL = "http://localhost:3000";

export function appUrl(path = "/connect"): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
