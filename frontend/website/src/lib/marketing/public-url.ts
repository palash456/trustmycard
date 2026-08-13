import type { NextRequest } from "next/server";

function configuredAppOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  return configured.replace(/\/$/, "");
}

/** Public site origin for redirects behind Render/proxy (request.nextUrl may be localhost). */
export function publicSiteUrl(request: NextRequest, pathname: string): URL {
  const origin = configuredAppOrigin() ?? request.nextUrl.origin;
  return new URL(pathname, origin);
}
