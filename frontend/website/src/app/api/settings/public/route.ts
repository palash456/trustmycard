import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase(): string {
  const raw =
    process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:4000";
  return raw.replace(/\/\/localhost\b/i, "//127.0.0.1");
}

export async function GET() {
  try {
    const upstream = await fetch(`${backendBase()}/v1/api/settings/public`, {
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
          err instanceof Error ? err.message : "settings/public proxy failed",
      },
      { status: 502 },
    );
  }
}
