import { NextRequest, NextResponse } from "next/server";
import {
  probeSystemHealth,
  type SystemHealthScope,
} from "@/lib/production-system-health";

export const dynamic = "force-dynamic";

function resolveScope(raw: string | null): SystemHealthScope {
  return raw === "local" ? "local" : "production";
}

export async function GET(req: NextRequest) {
  const scope = resolveScope(req.nextUrl.searchParams.get("scope"));
  const result = await probeSystemHealth(scope);
  return NextResponse.json(result);
}
