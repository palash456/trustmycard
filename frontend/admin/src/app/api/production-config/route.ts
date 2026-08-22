import { NextRequest, NextResponse } from "next/server";
import { fetchAdminBackend } from "@/lib/admin-backend-fetch";
import { resolveAdminActor } from "@/lib/admin-identity";
import { fetchLiveWebsiteMetaPixel } from "@/lib/live-meta-pixel";
import { getErrorMessage } from "@/lib/observability";
import { productionConfigBackendOrError } from "@/lib/production-config-api";

type ProductionConfigPayload = {
  state?: { WEBSITE_DOMAIN?: string };
};

async function attachLiveWebsiteMetaPixel(text: string): Promise<string> {
  try {
    const payload = JSON.parse(text) as ProductionConfigPayload;
    const domain = payload.state?.WEBSITE_DOMAIN?.trim();
    if (!domain) return text;

    const liveWebsite = await fetchLiveWebsiteMetaPixel(domain);
    return JSON.stringify({ ...payload, liveWebsite });
  } catch {
    return text;
  }
}

async function proxy(req: NextRequest) {
  const resolved = productionConfigBackendOrError();
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error, code: resolved.code },
      { status: resolved.status },
    );
  }
  const { backend } = resolved;

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
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body", code: "UPSTREAM_ERROR" },
        { status: 400 },
      );
    }
  }

  try {
    const response = await fetchAdminBackend(
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
    const text = await response.text();
    if (!text.trim()) {
      return NextResponse.json(
        {
          error: `Production API returned an empty response (${response.status})`,
          code: response.ok ? "UPSTREAM_ERROR" : "UPSTREAM_ERROR",
        },
        { status: response.ok ? 502 : response.status || 502 },
      );
    }
    const responseBody =
      req.method === "GET" && response.ok
        ? await attachLiveWebsiteMetaPixel(text)
        : text;
    return new NextResponse(responseBody, {
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

export const GET = proxy;
export const POST = proxy;
