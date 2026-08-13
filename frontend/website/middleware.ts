import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { copyClickIdentifiers } from "@/lib/marketing/detect-click";
import { createClientBinding } from "@/lib/marketing/client-binding";
import {
  createHomepageAttestationToken,
  homepageAttestationCookieOptions,
} from "@/lib/marketing/homepage-attestation";
import { withNoIndex } from "@/lib/marketing/http";
import {
  clearLegacyAdAccessCookie,
  MARKETING_SESSION_COOKIE,
  verifyMarketingSessionToken,
} from "@/lib/marketing-session";

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isConnectPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/connect" || path.startsWith("/connect/");
}

function isMarketingApiPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/api/marketing-test" || path.startsWith("/api/marketing/");
}

function withPathname(response: NextResponse, pathname: string): NextResponse {
  response.headers.set("x-pathname", pathname);
  return response;
}

function redirectHome(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  const response = NextResponse.redirect(url);
  response.cookies.set(clearLegacyAdAccessCookie());
  return response;
}

function redirectConnect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/connect";
  url.search = "";
  return NextResponse.redirect(url);
}

function redirectMarketingVerify(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/api/marketing/verify";
  url.search = "";
  const verifyParams = new URLSearchParams();
  copyClickIdentifiers(request.nextUrl.searchParams, verifyParams);
  url.search = verifyParams.toString();
  return NextResponse.redirect(url);
}

async function redirectMarketingVerifyFromHome(
  request: NextRequest,
): Promise<NextResponse> {
  const response = redirectMarketingVerify(request);
  const clientBinding = await createClientBinding(request);
  const attestation = await createHomepageAttestationToken(clientBinding);
  if (attestation) {
    response.cookies.set(homepageAttestationCookieOptions(attestation));
  }
  return response;
}

function hasClickIdentifier(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has("gclid") ||
    searchParams.has("gbraid") ||
    searchParams.has("wbraid") ||
    searchParams.has("fbclid") ||
    searchParams.has("ttclid") ||
    searchParams.has("li_fat_id")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const path = normalizePathname(pathname);
  const needsSession = path === "/" || isConnectPath(pathname);
  const hasSession = needsSession
    ? await verifyMarketingSessionToken(
        request.cookies.get(MARKETING_SESSION_COOKIE)?.value,
      )
    : false;

  if (path === "/") {
    if (hasClickIdentifier(searchParams)) {
      return redirectMarketingVerifyFromHome(request);
    }

    if (hasSession) {
      return redirectConnect(request);
    }

    const response = withPathname(NextResponse.next(), pathname);
    response.cookies.set(clearLegacyAdAccessCookie());
    return response;
  }

  if (isConnectPath(pathname) && !hasSession) {
    return redirectHome(request);
  }

  if (isConnectPath(pathname) || isMarketingApiPath(pathname)) {
    return withNoIndex(withPathname(NextResponse.next(), pathname));
  }

  return withPathname(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/", "/:path*"],
};
