import { NextRequest, NextResponse } from "next/server";
import { BACKEND_BASE } from "../../../backend-base";
import { logServerError } from "../../../../observability/server-logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/resources/verify
 * Proxies to ResourceManager.verifyResources() on the Nest backend.
 */
export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const upstream = await fetch(`${BACKEND_BASE}/v1/api/resources/verify`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
      },
      body: bodyText,
      cache: "no-store",
    });
    const raw = await upstream.text();
    return new NextResponse(raw, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    logServerError("resources/verify", "request", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "resources/verify proxy failed",
      },
      { status: 502 }
    );
  }
}
