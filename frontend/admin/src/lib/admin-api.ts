import { getDefaultAdminBackend, type AdminBackendConfig } from "./admin-backend";
import { getErrorMessage } from "./observability";

export async function adminFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  backend: AdminBackendConfig = getDefaultAdminBackend()
): Promise<T> {
  const apiKey = backend.apiKey.trim();
  if (!apiKey) {
    throw new Error("ADMIN_API_KEY is not configured on the admin server");
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${backend.baseUrl}/v1/api${normalized}`;

  const headers = new Headers(init.headers);
  headers.set("x-admin-api-key", apiKey);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  let json: T;
  try {
    json = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(`Invalid JSON from backend (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err = json as { message?: string | string[]; error?: string | { message?: string } };
    throw new Error(
      getErrorMessage(err.message ?? err.error ?? err, `Backend error ${res.status}`)
    );
  }

  return json;
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
