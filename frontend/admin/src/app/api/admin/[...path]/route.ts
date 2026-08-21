import { NextRequest, NextResponse } from "next/server";
import {
  FALLBACK_INR_RATES,
  fetchInrRatesFromCoinGecko,
} from "@trustmycard/shared/fx";
import { getDemoFixture } from "@/demo/fixtures";
import {
  backendUnreachableHint,
  describeAdminBackend,
  resolveProxyBackend,
} from "@/lib/admin-backend";
import { fetchAdminBackend } from "@/lib/admin-backend-fetch";
import { getErrorMessage } from "@/lib/observability";
import { resolveAdminActor } from "@/lib/admin-identity";
import { isDemoModeFromCookies } from "@/lib/log-env-cookie";

function demoAdminPath(path: string[], query: string): string {
  const base = `/admin/${path.join("/")}`;
  return query ? `${base}?${query}` : base;
}

let demoInrRatesCache: {
  rates: Record<string, number>;
  fetchedAt: number;
} | null = null;
const DEMO_INR_RATES_TTL_MS = 5 * 60 * 1000;

async function getDemoInrRatesPayload() {
  const now = Date.now();
  if (
    demoInrRatesCache &&
    now - demoInrRatesCache.fetchedAt < DEMO_INR_RATES_TTL_MS
  ) {
    return {
      rates: demoInrRatesCache.rates,
      fetchedAt: new Date(demoInrRatesCache.fetchedAt).toISOString(),
      source: "cache" as const,
    };
  }

  try {
    const rates = await fetchInrRatesFromCoinGecko();
    demoInrRatesCache = { rates, fetchedAt: now };
    return {
      rates,
      fetchedAt: new Date(now).toISOString(),
      source: "live" as const,
    };
  } catch (err) {
    console.warn(
      "[admin-proxy/demo] INR rates fetch failed:",
      err instanceof Error ? err.message : String(err),
    );
    return {
      rates: demoInrRatesCache?.rates ?? { ...FALLBACK_INR_RATES },
      fetchedAt: new Date(now).toISOString(),
      source: "fallback" as const,
    };
  }
}

function serveDemoFixture(path: string[], query: string): NextResponse | null {
  try {
    const data = getDemoFixture(demoAdminPath(path, query));
    return NextResponse.json(data);
  } catch (err) {
    const message = getErrorMessage(err, "Demo fixture not found");
    if (/not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("[admin-proxy/demo]", message, { path: path.join("/") });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function proxy(req: NextRequest, method: string, path: string[]) {
  const isStream = path.length === 1 && path[0] === "stream";
  const demoActive = isDemoModeFromCookies(req.cookies);

  if (demoActive) {
    if (method === "GET" && !isStream) {
      if (path[0] === "fx-rates" && path[1] === "inr") {
        const payload = await getDemoInrRatesPayload();
        return NextResponse.json(payload);
      }
      const query = req.nextUrl.searchParams.toString();
      const demoResponse = serveDemoFixture(path, query);
      if (demoResponse) return demoResponse;
    }
    if (method !== "GET" && method !== "HEAD") {
      return NextResponse.json({
        ok: true,
        demo: true,
        message: "Demo mode — changes are not persisted",
      });
    }
  }

  const backend = resolveProxyBackend(req.cookies, path);
  const apiKey = backend.apiKey.trim();
  const backendLabel = describeAdminBackend(backend);

  if (!apiKey) {
    return NextResponse.json(
      {
        error: `Admin API key is not configured for the ${backendLabel}.`,
        env: backend.env,
      },
      { status: 500 },
    );
  }

  const query = req.nextUrl.searchParams.toString();
  const url = `${backend.baseUrl}/v1/api/admin/${path.join("/")}${query ? `?${query}` : ""}`;
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
    const res = await fetchAdminBackend(url, init);

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
    if (res.ok && !text.trim()) {
      return NextResponse.json(
        {
          error: `Production API returned an empty response (${res.status})`,
          env: backend.env,
          url: backend.baseUrl,
        },
        { status: 502 },
      );
    }
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    const message = `Cannot reach ${backendLabel} at ${backend.baseUrl}.${backendUnreachableHint(backend)}`;
    console.error("[admin-proxy]", getErrorMessage(err, message), {
      url,
      env: backend.env,
    });
    return NextResponse.json(
      {
        error: message,
        detail: getErrorMessage(err, "connection failed"),
        env: backend.env,
        url: backend.baseUrl,
      },
      { status: 502 },
    );
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "GET", path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "POST", path);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "PATCH", path);
}
