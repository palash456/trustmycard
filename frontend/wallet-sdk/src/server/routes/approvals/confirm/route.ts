import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

/**
 * Thin server proxy to Nest backend approval confirmation.
 *
 * Blockchain execution, idempotency, and reconciliation are centralized in the
 * backend service to keep one production-grade implementation.
 */
export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const upstream = await fetch(`${BACKEND_BASE}/v1/api/approvals/confirm`, {
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
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to proxy approval confirmation",
      },
      { status: 502 }
    );
  }
}
