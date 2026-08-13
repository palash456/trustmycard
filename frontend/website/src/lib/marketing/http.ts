import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function redirectHome(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export function redirectConnect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/connect";
  url.search = "";
  return NextResponse.redirect(url);
}

export function withNoIndex(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export function noStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return withNoIndex(response);
}
