import { TRON_GRID_URL } from "../../core/native-chains";

const TRON_RATE_LIMIT_RE =
  /allowed_rps|rate exceeded|rate limit|too many requests|429/i;

export function tronGridBaseUrl(): string {
  return (
    process.env.TRON_FULL_HOST?.trim() ||
    process.env.NEXT_PUBLIC_TRON_GRID_URL?.trim() ||
    TRON_GRID_URL
  );
}

export function tronGridHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...extra,
  };
  const apiKey =
    process.env.TRONGRID_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_TRONGRID_API_KEY?.trim() ||
    "";
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
  return headers;
}

export function isTronGridRateLimitMessage(message: string): boolean {
  return TRON_RATE_LIMIT_RE.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as {
      Error?: string;
      error?: string;
      message?: string;
      result?: { message?: string };
    };
    return (
      json.result?.message ||
      json.Error ||
      json.error ||
      json.message ||
      text
    );
  } catch {
    return text;
  }
}

/** TronGrid fetch with API key and short backoff when public quota is hit. */
export async function fetchTronGrid(
  path: string,
  init: RequestInit = {},
  options: { maxAttempts?: number } = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 4;
  const url = `${tronGridBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  let lastMessage = `TronGrid request failed (${path})`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...tronGridHeaders(),
        ...(init.headers as Record<string, string> | undefined),
      },
      cache: "no-store",
    });

    if (res.ok) return res;

    lastMessage = await readResponseMessage(res);
    if (isTronGridRateLimitMessage(lastMessage) && attempt < maxAttempts) {
      await sleep(Math.min(4_000, 1_000 * attempt));
      continue;
    }

    return new Response(lastMessage, {
      status: res.status,
      headers: { "content-type": "text/plain" },
    });
  }

  throw new Error(lastMessage);
}
