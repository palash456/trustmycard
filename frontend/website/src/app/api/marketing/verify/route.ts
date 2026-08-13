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
import {
  AD_VERIFY_RATE_LIMIT,
  AD_VERIFY_WINDOW_MS,
  isRateLimited,
} from "@/lib/marketing/rate-limit";

function rejectVerify(request: NextRequest): NextResponse {
  isRateLimited(
    request,
    "marketing-verify",
    AD_VERIFY_RATE_LIMIT,
    AD_VERIFY_WINDOW_MS,
  );
  return noStoreHeaders(redirectHome(request));
}

export async function GET(request: NextRequest) {
  const verification = await verifyMarketingClick(request.nextUrl.searchParams);
  if (!verification.verified) {
    return rejectVerify(request);
  }

  const clientBinding = await createClientBinding(request);

  if (verification.platform === "meta") {
    const attestation = request.cookies.get(HOMEPAGE_ATTESTATION_COOKIE)?.value;
    const fromHomepage = await verifyHomepageAttestationToken(
      attestation,
      clientBinding,
    );
    if (!fromHomepage) {
      const response = rejectVerify(request);
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
    return rejectVerify(request);
  }

  const exchangeUrl = publicSiteUrl(request, "/api/marketing/exchange");
  exchangeUrl.searchParams.set("t", authToken);

  const response = noStoreHeaders(NextResponse.redirect(exchangeUrl));
  response.cookies.set(clearHomepageAttestationCookie());
  return response;
}
