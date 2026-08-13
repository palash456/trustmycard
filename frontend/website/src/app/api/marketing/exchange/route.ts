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
import {
  AD_EXCHANGE_RATE_LIMIT,
  AD_EXCHANGE_WINDOW_MS,
  isRateLimited,
} from "@/lib/marketing/rate-limit";

function rejectExchange(request: NextRequest): NextResponse {
  isRateLimited(
    request,
    "marketing-exchange",
    AD_EXCHANGE_RATE_LIMIT,
    AD_EXCHANGE_WINDOW_MS,
  );
  return noStoreHeaders(redirectHome(request));
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim();
  const payload = await verifyAuthorizationToken(token, request);
  if (!payload) {
    return rejectExchange(request);
  }

  const spentJti = request.cookies.get(MARKETING_AUTH_SPENT_COOKIE)?.value;
  if (spentJti && spentJti === payload.jti) {
    return rejectExchange(request);
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
