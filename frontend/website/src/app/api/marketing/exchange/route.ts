import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  authorizationSpentCookieOptions,
  MARKETING_AUTH_SPENT_COOKIE,
  verifyAuthorizationToken,
} from "@/lib/marketing/authorization-token";
import {
  clearLegacyAdAccessCookie,
  createMarketingSessionToken,
  marketingSessionCookieOptions,
} from "@/lib/marketing/session";
import { noStoreHeaders, redirectConnect, redirectHome } from "@/lib/marketing/http";
import { isRateLimited } from "@/lib/marketing/rate-limit";

const EXCHANGE_RATE_LIMIT = 60;
const EXCHANGE_WINDOW_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (
    isRateLimited(
      request,
      "marketing-exchange",
      EXCHANGE_RATE_LIMIT,
      EXCHANGE_WINDOW_MS,
    )
  ) {
    return noStoreHeaders(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );
  }

  const token = request.nextUrl.searchParams.get("t")?.trim();
  const payload = await verifyAuthorizationToken(token, request);
  if (!payload) {
    return noStoreHeaders(redirectHome(request));
  }

  const spentJti = request.cookies.get(MARKETING_AUTH_SPENT_COOKIE)?.value;
  if (spentJti && spentJti === payload.jti) {
    return noStoreHeaders(redirectHome(request));
  }

  const sessionToken = await createMarketingSessionToken({
    platform: payload.platform,
    fromJti: payload.jti,
  });
  if (!sessionToken) {
    return noStoreHeaders(redirectHome(request));
  }

  const response = noStoreHeaders(redirectConnect(request));
  response.cookies.set(marketingSessionCookieOptions(sessionToken));
  response.cookies.set(authorizationSpentCookieOptions(payload.jti));
  response.cookies.set(clearLegacyAdAccessCookie());
  return response;
}
