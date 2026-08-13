import type { NextRequest } from "next/server";

import { createClientBinding } from "./client-binding";
import {
  base64UrlEncode,
  getMarketingSecret,
  randomNonce,
  signPayload,
  sha256Hex,
  verifySignedPayload,
} from "./crypto";

export const MARKETING_AUTH_SPENT_COOKIE = "tv_ma_spent";
export const MARKETING_AUTH_TOKEN_TTL_MS = 90 * 1000;

const TOKEN_TYPE = "mkt_once";
const TOKEN_VERSION = 1;

type AuthorizationTokenPayload = {
  v: number;
  typ: string;
  iat: number;
  exp: number;
  jti: string;
  bind: string;
  platform: string;
  clickHash: string;
};

export async function createAuthorizationToken(input: {
  platform: string;
  clickId: string;
  clientBinding: string;
}): Promise<string | null> {
  const secret = getMarketingSecret();
  if (!secret) return null;

  const now = Date.now();
  const payload: AuthorizationTokenPayload = {
    v: TOKEN_VERSION,
    typ: TOKEN_TYPE,
    iat: now,
    exp: now + MARKETING_AUTH_TOKEN_TTL_MS,
    jti: randomNonce(),
    bind: input.clientBinding,
    platform: input.platform,
    clickHash: await sha256Hex(input.clickId),
  };
  const encoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const sig = await signPayload(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifyAuthorizationToken(
  token: string | undefined,
  request: NextRequest,
): Promise<AuthorizationTokenPayload | null> {
  if (!token) return null;
  const secret = getMarketingSecret();
  if (!secret) return null;

  const data = await verifySignedPayload(token, secret);
  if (!data) return null;

  const payload = data as Partial<AuthorizationTokenPayload>;
  if (
    payload.v !== TOKEN_VERSION ||
    payload.typ !== TOKEN_TYPE ||
    typeof payload.exp !== "number" ||
    payload.exp <= Date.now() ||
    typeof payload.jti !== "string" ||
    typeof payload.bind !== "string" ||
    typeof payload.platform !== "string" ||
    typeof payload.clickHash !== "string"
  ) {
    return null;
  }

  const clientBinding = await createClientBinding(request);
  if (payload.bind !== clientBinding) return null;

  return payload as AuthorizationTokenPayload;
}

export function authorizationSpentCookieOptions(jti: string) {
  return {
    name: MARKETING_AUTH_SPENT_COOKIE,
    value: jti,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MARKETING_AUTH_TOKEN_TTL_MS / 1000 + 30,
  };
}
