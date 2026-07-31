import { getErrorMessage } from "./observability";

const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:4000";

export async function adminFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ADMIN_API_KEY is not configured on the admin server");
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = `${BACKEND_BASE}/v1/api${normalized}`;

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
