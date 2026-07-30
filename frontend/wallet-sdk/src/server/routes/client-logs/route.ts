import { NextRequest, NextResponse } from "next/server";
import { observabilityIngestUrl } from "../../backend-base";
import { logServerError } from "../../../observability/server-logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const backend = observabilityIngestUrl();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch(backend, {
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
