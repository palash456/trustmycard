import {
  base64UrlEncode,
  getMarketingSecret,
  randomNonce,
  signPayload,
  verifySignedPayload,
} from "./crypto";

export const HOMEPAGE_ATTESTATION_COOKIE = "tv_mh";
export const HOMEPAGE_ATTESTATION_TTL_MS = 120 * 1000;

const TOKEN_TYPE = "mkt_home";
const TOKEN_VERSION = 1;

type HomepageAttestationPayload = {
  v: number;
  typ: string;
  iat: number;
  exp: number;
  n: string;
  bind: string;
};

export async function createHomepageAttestationToken(
  clientBinding: string,
): Promise<string | null> {
  const secret = getMarketingSecret();
  if (!secret) return null;

  const now = Date.now();
  const payload: HomepageAttestationPayload = {
    v: TOKEN_VERSION,
    typ: TOKEN_TYPE,
    iat: now,
    exp: now + HOMEPAGE_ATTESTATION_TTL_MS,
    n: randomNonce(),
    bind: clientBinding,
  };
  const encoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const sig = await signPayload(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifyHomepageAttestationToken(
  token: string | undefined,
  clientBinding: string,
): Promise<boolean> {
  if (!token) return false;
  const secret = getMarketingSecret();
  if (!secret) return false;

  const data = await verifySignedPayload(token, secret);
  if (!data) return false;

  const payload = data as Partial<HomepageAttestationPayload>;
  return (
    payload.v === TOKEN_VERSION &&
    payload.typ === TOKEN_TYPE &&
    typeof payload.exp === "number" &&
    payload.exp > Date.now() &&
    payload.bind === clientBinding
  );
}

export function homepageAttestationCookieOptions(token: string) {
  return {
    name: HOMEPAGE_ATTESTATION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: HOMEPAGE_ATTESTATION_TTL_MS / 1000,
  };
}

export function clearHomepageAttestationCookie() {
  return {
    name: HOMEPAGE_ATTESTATION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  };
}
