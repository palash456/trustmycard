import { NextRequest, NextResponse } from "next/server";
import { resolveAdminActor } from "@/lib/admin-identity";
import { getErrorMessage } from "@/lib/observability";
import { productionConfigBackendOrError } from "@/lib/production-config-api";

export async function GET(req: NextRequest) {
  const resolved = productionConfigBackendOrError();
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }
  const { backend } = resolved;

  try {
    const response = await fetch(
      `${backend.baseUrl}/v1/api/admin/production-config/history${req.nextUrl.search}`,
      {
        headers: {
          "x-admin-api-key": backend.apiKey,
          "x-admin-actor": resolveAdminActor(req),
        },
        cache: "no-store",
      },
    );
    const text = await response.text();
    if (!text.trim()) {
      return NextResponse.json(
        {
          error: `Production API returned an empty response (${response.status})`,
          code: "UPSTREAM_ERROR",
        },
        { status: response.ok ? 502 : response.status || 502 },
      );
    }
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: getErrorMessage(
          err,
          "Cannot reach the production API. Check BACKEND_API_URL and network access.",
        ),
        code: "NOT_CONNECTED",
      },
      { status: 502 },
    );
  }
}
