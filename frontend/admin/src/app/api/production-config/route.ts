import { NextRequest, NextResponse } from "next/server";
import { resolveAdminActor } from "@/lib/admin-identity";
import { resolveProxyBackend } from "@/lib/admin-backend";

async function proxy(req: NextRequest) {
  const backend = resolveProxyBackend(req.cookies, ["production-config"]);
  if (!backend.apiKey.trim())
    return NextResponse.json(
      { error: "Admin API key is not configured" },
      { status: 500 },
    );
  const body = req.method === "POST" ? await req.text() : undefined;
  let path = "";
  if (body) {
    try {
      const value = JSON.parse(body);
      path =
        typeof value.domain === "string"
          ? "/domain"
          : typeof value.pixel === "string"
            ? "/pixel"
            : "";
    } catch {}
  }
  const response = await fetch(
    `${backend.baseUrl}/v1/api/admin/production-config${path}`,
    {
      method: req.method,
      headers: {
        "content-type": "application/json",
        "x-admin-api-key": backend.apiKey,
        "x-admin-actor": resolveAdminActor(req),
      },
      body,
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
export const GET = proxy;
export const POST = proxy;
