export const MARKETING_SESSION_COOKIE = "tv_ms";
export const LEGACY_AD_ACCESS_COOKIE = "tv_src";
export const MARKETING_SESSION_TTL_MS = 60 * 60 * 24 * 1000;

const TOKEN_TYPE = "mkt";
const TOKEN_VERSION = 1;

type MarketingSessionPayload = {
  v: number;
  typ: string;
  iat: number;
  exp: number;
  n: string;
};

function getSecret(): string | null {
  const fromEnv = process.env.MARKETING_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") {
    return "dev-marketing-session-secret";
  }
  return null;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

export async function createMarketingSessionToken(): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;

  const now = Date.now();
  const payload: MarketingSessionPayload = {
    v: TOKEN_VERSION,
    typ: TOKEN_TYPE,
    iat: now,
    exp: now + MARKETING_SESSION_TTL_MS,
    n: randomNonce(),
  };
  const encoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const sig = await signPayload(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifyMarketingSessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  try {
    const expected = await signPayload(payload, secret);
    const a = base64UrlDecode(sig);
    const b = base64UrlDecode(expected);
    if (!timingSafeEqual(a, b)) return false;

    const data = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as Partial<MarketingSessionPayload>;

    return (
      data.v === TOKEN_VERSION &&
      data.typ === TOKEN_TYPE &&
      typeof data.exp === "number" &&
      data.exp > Date.now()
    );
  } catch {
    return false;
  }
}

export function marketingSessionCookieOptions(token: string) {
  return {
    name: MARKETING_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MARKETING_SESSION_TTL_MS / 1000,
  };
}
