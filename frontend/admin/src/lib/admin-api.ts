import {
  backendUnreachableHint,
  describeAdminBackend,
  getDevBackend,
  type AdminBackendConfig,
} from "./admin-backend";
import { getErrorMessage } from "./observability";

export async function adminFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  backend: AdminBackendConfig = getDevBackend(),
): Promise<T> {
  const apiKey = backend.apiKey.trim();
  if (!apiKey) {
    const label = describeAdminBackend(backend);
    throw new Error(
      `Admin API key is not configured for the ${label}. Check frontend/admin/.env.local.`,
    );
  }

  if (!backend.baseUrl.trim()) {
    const label = describeAdminBackend(backend);
    throw new Error(
      `Production backend URL is not configured for the ${label}.${backendUnreachableHint(backend)}`,
    );
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${backend.baseUrl}/v1/api${normalized}`;
  const backendLabel = describeAdminBackend(backend);

  const headers = new Headers(init.headers);
  headers.set("x-admin-api-key", apiKey);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(
      `Cannot reach ${backendLabel} at ${backend.baseUrl}.${backendUnreachableHint(backend)} (${getErrorMessage(err, "connection failed")})`,
    );
  }

  const text = await res.text();
  let json: T;
  try {
    json = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(
      `[${backendLabel}] Invalid JSON (${res.status}) from ${backend.baseUrl}: ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok) {
    const err = json as {
      message?: string | string[];
      error?: string | { message?: string };
    };
    const detail = getErrorMessage(
      err.message ?? err.error ?? err,
      `HTTP ${res.status}`,
    );
    throw new Error(`[${backendLabel}] ${detail}`);
  }

  return json;
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
