import { NextRequest, NextResponse } from "next/server";
import { resolveAdminActor } from "@/lib/admin-identity";
import { resolveProxyBackend } from "@/lib/admin-backend";
export async function GET(req: NextRequest) {
  const backend = resolveProxyBackend(req.cookies, [
    "production-config",
    "history",
  ]);
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
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") || "application/json",
    },
  });
}
