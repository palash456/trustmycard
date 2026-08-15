import {
  base64UrlEncode,
  getMarketingSecret,
  randomNonce,
  signPayload,
  timingSafeEqual,
  verifySignedPayload,
} from "./crypto";
import { getMarketingSessionTtlMs } from "./session-config";

export const MARKETING_SESSION_COOKIE = "tv_ms";
export const LEGACY_AD_ACCESS_COOKIE = "tv_src";

const TOKEN_TYPE = "mkt";
const TOKEN_VERSION = 1;

type MarketingSessionPayload = {
  v: number;
  typ: string;
  iat: number;
  exp: number;
  n: string;
  platform?: string;
  fromJti?: string;
};

export async function createMarketingSessionToken(options?: {
  platform?: string;
  fromJti?: string;
}): Promise<string | null> {
  const secret = getMarketingSecret();
  if (!secret) return null;

  const now = Date.now();
  const ttlMs = getMarketingSessionTtlMs();
  const payload: MarketingSessionPayload = {
    v: TOKEN_VERSION,
    typ: TOKEN_TYPE,
    iat: now,
    exp: now + ttlMs,
    n: randomNonce(),
    ...(options?.platform ? { platform: options.platform } : {}),
    ...(options?.fromJti ? { fromJti: options.fromJti } : {}),
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
  const secret = getMarketingSecret();
  if (!secret) return false;

  const data = await verifySignedPayload(token, secret);
  if (!data) return false;

  return (
    data.v === TOKEN_VERSION &&
    data.typ === TOKEN_TYPE &&
    typeof data.exp === "number" &&
    data.exp > Date.now()
  );
}

export function marketingSessionCookieOptions(token: string) {
  const ttlMs = getMarketingSessionTtlMs();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const secure =
    appUrl?.startsWith("https://") ??
    process.env.NODE_ENV === "production";
  return {
    name: MARKETING_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ttlMs / 1000,
  };
}

export function clearLegacyAdAccessCookie() {
  return {
    name: LEGACY_AD_ACCESS_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  };
}
