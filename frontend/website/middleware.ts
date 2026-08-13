import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AD_ACCESS_COOKIE = "tv_src";
const AD_ACCESS_MAX_AGE_SEC = 60 * 60 * 24;

const AD_UTM_SOURCES = new Set([
  "instagram",
  "facebook",
  "fb",
  "ig",
  "meta",
  "google",
]);

const AD_UTM_MEDIUMS = new Set(["paid", "cpc", "ppc", "paidsocial"]);

function isAdTraffic(searchParams: URLSearchParams): boolean {
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

function hasAdAccess(request: NextRequest): boolean {
  return (
    isAdTraffic(request.nextUrl.searchParams) ||
    request.cookies.get(AD_ACCESS_COOKIE)?.value === "1"
  );
}

function grantAdAccess(response: NextResponse): NextResponse {
  response.cookies.set(AD_ACCESS_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AD_ACCESS_MAX_AGE_SEC,
  });
  return response;
}

function withPathname(response: NextResponse, pathname: string): NextResponse {
  response.headers.set("x-pathname", pathname);
  return response;
}

const PUBLIC_CONNECT_PATHS = new Set([
  "/connect/privacypolicy",
  "/connect/termsandconditions",
  "/connect/frequentlyaskedquestions",
]);

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isGatedConnectPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (PUBLIC_CONNECT_PATHS.has(path)) return false;
  return path === "/connect" || path.startsWith("/connect/");
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const adTraffic = isAdTraffic(searchParams);

  if (pathname === "/" && adTraffic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connect";
    return grantAdAccess(NextResponse.redirect(url));
  }

  if (isGatedConnectPath(pathname) && !hasAdAccess(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = withPathname(NextResponse.next(), pathname);
  return adTraffic ? grantAdAccess(response) : response;
}

export const config = {
  matcher: ["/", "/:path*"],
};
