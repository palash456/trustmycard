import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createMarketingSessionToken,
  LEGACY_AD_ACCESS_COOKIE,
  MARKETING_SESSION_COOKIE,
  marketingSessionCookieOptions,
  verifyMarketingSessionToken,
} from "@/lib/marketing-session";

const AD_UTM_SOURCES = new Set([
  "instagram",
  "facebook",
  "fb",
  "ig",
  "meta",
  "google",
]);

const AD_UTM_MEDIUMS = new Set(["paid", "cpc", "ppc", "paidsocial"]);

function isMarketingTraffic(searchParams: URLSearchParams): boolean {
  const source = (searchParams.get("utm_source") ?? "").toLowerCase();
  const medium = (searchParams.get("utm_medium") ?? "").toLowerCase();

  if (AD_UTM_SOURCES.has(source)) return true;
  if (AD_UTM_MEDIUMS.has(medium)) return true;
  if (
    searchParams.has("fbclid") ||
    searchParams.has("gclid") ||
    searchParams.has("gbraid") ||
    searchParams.has("wbraid")
  ) {
    return true;
  }
  return false;
}

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

function withPathname(response: NextResponse, pathname: string): NextResponse {
  response.headers.set("x-pathname", pathname);
  return response;
}

function clearLegacyCookie(response: NextResponse): NextResponse {
  response.cookies.set(LEGACY_AD_ACCESS_COOKIE, "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}

function attachMarketingSession(
  response: NextResponse,
  token: string,
): NextResponse {
  const cookie = marketingSessionCookieOptions(token);
  response.cookies.set(cookie);
  return clearLegacyCookie(response);
}

function redirectHome(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return clearLegacyCookie(NextResponse.redirect(url));
}

function redirectConnect(
  request: NextRequest,
  preserveSearch: boolean,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/connect";
  if (!preserveSearch) url.search = "";
  return NextResponse.redirect(url);
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
    if (isMarketingTraffic(searchParams)) {
      const token = await createMarketingSessionToken();
      if (!token) {
        return withPathname(NextResponse.next(), pathname);
      }
      return attachMarketingSession(redirectConnect(request, true), token);
    }

    if (hasSession) {
      return redirectConnect(request, false);
    }

    return withPathname(clearLegacyCookie(NextResponse.next()), pathname);
  }

  if (isConnectPath(pathname) && !hasSession) {
    return redirectHome(request);
  }

  return withPathname(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/", "/:path*"],
};
