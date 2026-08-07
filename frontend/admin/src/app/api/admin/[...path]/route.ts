import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/observability";
import { resolveAdminActor } from "@/lib/admin-identity";

const BACKEND_BASE =
  process.env.BACKEND_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

async function proxy(req: NextRequest, method: string, path: string[]) {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "ADMIN_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const isStream = path.length === 1 && path[0] === "stream";
  const query = req.nextUrl.searchParams.toString();
  const url = `${BACKEND_BASE}/v1/api/admin/${path.join("/")}${query ? `?${query}` : ""}`;
  const adminActor = resolveAdminActor(req);

  const init: RequestInit = {
    method,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      "x-admin-api-key": apiKey,
      "x-admin-actor": adminActor,
      accept: isStream ? "text/event-stream" : "application/json",
    },
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url, init);

    if (isStream) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    }

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    console.error("[admin-proxy]", getErrorMessage(err, "Backend proxy failed"), { url });
    return NextResponse.json(
      {
        error: getErrorMessage(err, "Backend proxy failed"),
        url,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, "GET", path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, "POST", path);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, "PATCH", path);
}
