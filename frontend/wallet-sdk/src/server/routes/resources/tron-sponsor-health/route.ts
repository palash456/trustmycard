import { NextRequest, NextResponse } from "next/server";
import { BACKEND_BASE } from "../../../backend-base";
import { logServerError } from "../../../../observability/server-logger";

export const dynamic = "force-dynamic";

/** GET /api/resources/tron-sponsor-health */
export async function GET(_req: NextRequest) {
  try {
    const upstream = await fetch(
      `${BACKEND_BASE}/v1/api/resources/tron-sponsor-health`,
      { cache: "no-store" },
    );
    const raw = await upstream.text();
    return new NextResponse(raw, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    logServerError("resources/tron-sponsor-health", "request", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "resources/tron-sponsor-health proxy failed",
      },
      { status: 502 },
    );
  }
}
