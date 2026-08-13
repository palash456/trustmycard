import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { timingSafeStringEqual } from "@/lib/marketing/crypto";
import {
  clearLegacyAdAccessCookie,
  createMarketingSessionToken,
  marketingSessionCookieOptions,
} from "@/lib/marketing/session";
import { noStoreHeaders, redirectConnect } from "@/lib/marketing/http";
import { isRateLimited } from "@/lib/marketing/rate-limit";

const TEST_FAILED_ATTEMPT_LIMIT = 30;
const TEST_WINDOW_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.MARKETING_TEST_SECRET?.trim();
  if (!configuredSecret) {
    return noStoreHeaders(new NextResponse(null, { status: 404 }));
  }

  const provided = request.nextUrl.searchParams.get("token") ?? "";
  if (!provided || !timingSafeStringEqual(provided, configuredSecret)) {
    if (
      isRateLimited(
        request,
        "marketing-test",
        TEST_FAILED_ATTEMPT_LIMIT,
        TEST_WINDOW_MS,
      )
    ) {
      return noStoreHeaders(
        NextResponse.json({ error: "Too many requests" }, { status: 429 }),
      );
    }
    return noStoreHeaders(new NextResponse(null, { status: 404 }));
  }

  const sessionToken = await createMarketingSessionToken({
    platform: "developer-test",
  });
  if (!sessionToken) {
    return noStoreHeaders(new NextResponse(null, { status: 500 }));
  }

  const response = noStoreHeaders(redirectConnect(request));
  response.cookies.set(marketingSessionCookieOptions(sessionToken));
  response.cookies.set(clearLegacyAdAccessCookie());
  return response;
}
