import { NextRequest, NextResponse } from "next/server";
import { logServerError } from "../../../observability/server-logger";

export const dynamic = "force-dynamic";

const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

/**
 * POST /api/energy-delegate
 *
 * Legacy route name kept for compatibility.
 * Proxies to ResourceManager.acquireResources() on the Nest backend.
 * Call this AFTER /api/approvals/prepare so hints can include feeLimit / amountRaw.
 */
export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const upstream = await fetch(`${BACKEND_BASE}/v1/api/energy-delegate`, {
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
    logServerError("energy-delegate", "request", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "energy-delegate proxy failed",
      },
      { status: 502 },
    );
  }
}
