import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { publicSiteUrl } from "@/lib/marketing/public-url";

export function redirectHome(request: NextRequest): NextResponse {
  return NextResponse.redirect(publicSiteUrl(request, "/"));
}

export function redirectConnect(request: NextRequest): NextResponse {
  return NextResponse.redirect(publicSiteUrl(request, "/connect"));
}

export function withNoIndex(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export function noStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return withNoIndex(response);
}
