import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const upstream = await fetch(`${BACKEND_BASE}/v1/api/approvals/queue-collection`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        ...(req.headers.get("authorization")
          ? { authorization: req.headers.get("authorization")! }
          : {}),
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
            : "Failed to proxy queue-collection",
      },
      { status: 502 }
    );
  }
}
