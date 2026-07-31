import { NextRequest, NextResponse } from "next/server";
import { BACKEND_BASE } from "../../../backend-base";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const upstream = await fetch(`${BACKEND_BASE}/v1/api/native-transfers/estimate`, {
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
            : "Failed to proxy native transfer estimate",
      },
      { status: 502 }
    );
  }
}
