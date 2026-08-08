import { NextRequest, NextResponse } from "next/server";
import { probeAllBackendHealth } from "@/lib/backend-health";
import { getEnvFromCookies } from "@/lib/log-env-cookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const activeEnv = getEnvFromCookies(req.cookies);
  const result = await probeAllBackendHealth(activeEnv);
  return NextResponse.json(result);
}
