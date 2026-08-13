import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifyMarketingClick } from "@/lib/marketing/adapters/registry";
import {
  createAuthorizationToken,
} from "@/lib/marketing/authorization-token";
import { createClientBinding } from "@/lib/marketing/client-binding";
import {
  clearHomepageAttestationCookie,
  HOMEPAGE_ATTESTATION_COOKIE,
  verifyHomepageAttestationToken,
} from "@/lib/marketing/homepage-attestation";
import { noStoreHeaders, redirectHome } from "@/lib/marketing/http";
import { publicSiteUrl } from "@/lib/marketing/public-url";
import { isRateLimited } from "@/lib/marketing/rate-limit";

const VERIFY_RATE_LIMIT = 30;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (
    isRateLimited(request, "marketing-verify", VERIFY_RATE_LIMIT, VERIFY_WINDOW_MS)
  ) {
    return noStoreHeaders(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );
  }

  const verification = await verifyMarketingClick(request.nextUrl.searchParams);
  if (!verification.verified) {
    return noStoreHeaders(redirectHome(request));
  }

  const clientBinding = await createClientBinding(request);

  if (verification.platform === "meta") {
    const attestation = request.cookies.get(HOMEPAGE_ATTESTATION_COOKIE)?.value;
    const fromHomepage = await verifyHomepageAttestationToken(
      attestation,
      clientBinding,
    );
    if (!fromHomepage) {
      const response = noStoreHeaders(redirectHome(request));
      response.cookies.set(clearHomepageAttestationCookie());
      return response;
    }
  }

  const authToken = await createAuthorizationToken({
    platform: verification.platform,
    clickId: verification.clickId,
    clientBinding,
  });
  if (!authToken) {
    return noStoreHeaders(redirectHome(request));
  }

  const exchangeUrl = publicSiteUrl(request, "/api/marketing/exchange");
  exchangeUrl.searchParams.set("t", authToken);

  const response = noStoreHeaders(NextResponse.redirect(exchangeUrl));
  response.cookies.set(clearHomepageAttestationCookie());
  return response;
}
