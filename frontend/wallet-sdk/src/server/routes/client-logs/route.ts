import { NextRequest, NextResponse } from "next/server";
import { logServerError } from "../../../observability/server-logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const backend = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (!backend) {
    console.warn("[client-logs] BACKEND_URL not set — skip persist");
    return NextResponse.json({ ok: true, accepted: 0, skipped: true }, { status: 202 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch(`${backend}/v1/client-logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    let json: unknown = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    return NextResponse.json(json, { status: res.status });
  } catch (err: unknown) {
    logServerError("client-logs", "proxy", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Proxy failed" },
      { status: 502 }
    );
  }
}
