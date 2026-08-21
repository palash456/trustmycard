import { NextRequest, NextResponse } from "next/server";
import { fetchAdminBackend } from "@/lib/admin-backend-fetch";
import { resolveAdminActor } from "@/lib/admin-identity";
import { getErrorMessage } from "@/lib/observability";
import { productionConfigBackendOrError } from "@/lib/production-config-api";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ changeId: string }> },
) {
  const resolved = productionConfigBackendOrError();
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }
  const { backend } = resolved;
  const { changeId } = await ctx.params;

  try {
    const response = await fetchAdminBackend(
      `${backend.baseUrl}/v1/api/admin/production-config/stream/${encodeURIComponent(changeId)}`,
      {
        headers: {
          "x-admin-api-key": backend.apiKey,
          "x-admin-actor": resolveAdminActor(req),
          accept: "text/event-stream",
        },
        cache: "no-store",
      },
    );
    if (!response.ok || !response.body) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: text || `Stream failed (${response.status})`,
          code: "UPSTREAM_ERROR",
        },
        { status: response.status || 502 },
      );
    }
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: getErrorMessage(err, "Cannot reach the production API stream"),
        code: "NOT_CONNECTED",
      },
      { status: 502 },
    );
  }
}
