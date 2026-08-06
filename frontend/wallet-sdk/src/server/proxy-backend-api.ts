import { NextRequest, NextResponse } from "next/server";
import { BACKEND_BASE } from "./backend-base";

function forwardAuth(req: NextRequest): Record<string, string> {
  const authorization = req.headers.get("authorization");
  return authorization ? { authorization } : {};
}

export async function proxyBackendPost(
  req: NextRequest,
  upstreamPath: string,
  options?: { forwardAuthorization?: boolean }
): Promise<NextResponse> {
  try {
    const bodyText = await req.text();
    const upstream = await fetch(`${BACKEND_BASE}${upstreamPath}`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        ...(options?.forwardAuthorization === false ? {} : forwardAuth(req)),
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
            : `Failed to proxy ${upstreamPath}`,
      },
      { status: 502 }
    );
  }
}

export async function proxyBackendGet(
  req: NextRequest,
  upstreamPath: string,
  options?: { forwardAuthorization?: boolean }
): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${BACKEND_BASE}${upstreamPath}`, {
      method: "GET",
      headers: {
        ...(options?.forwardAuthorization === false ? {} : forwardAuth(req)),
      },
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
            : `Failed to proxy ${upstreamPath}`,
      },
      { status: 502 }
    );
  }
}
