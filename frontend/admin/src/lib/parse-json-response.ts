import { getErrorMessage } from "./observability";

export async function parseJsonResponse<T = unknown>(
  res: Response,
): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status: number; code?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      status: res.status,
      error: res.ok
        ? "Empty response from server"
        : `Request failed (${res.status}) with an empty response body`,
    };
  }
  try {
    const data = JSON.parse(text) as T;
    if (!res.ok) {
      const record = data as {
        error?: string;
        message?: string | string[];
        code?: string;
      };
      const detail =
        typeof record.error === "string"
          ? record.error
          : Array.isArray(record.message)
            ? record.message.join(", ")
            : typeof record.message === "string"
              ? record.message
              : `Request failed (${res.status})`;
      return {
        ok: false,
        status: res.status,
        error: detail,
        code: record.code,
      };
    }
    return { ok: true, data, status: res.status };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: `Invalid JSON (${res.status}): ${text.slice(0, 200)}`,
    };
  }
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; code?: string }> {
  try {
    const res = await fetch(input, init);
    return await parseJsonResponse<T>(res);
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: getErrorMessage(err, "Network request failed"),
      code: "NOT_CONNECTED",
    };
  }
}
