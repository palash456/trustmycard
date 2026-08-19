import { NextRequest, NextResponse } from "next/server";
import { resolveAdminActor } from "@/lib/admin-identity";
import { resolveProxyBackend } from "@/lib/admin-backend";
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ changeId: string }> },
) {
  const { changeId } = await ctx.params;
  const backend = resolveProxyBackend(req.cookies, [
    "production-config",
    "stream",
    changeId,
  ]);
  const response = await fetch(
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
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
