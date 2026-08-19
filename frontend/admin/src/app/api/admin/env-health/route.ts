import { NextRequest, NextResponse } from "next/server";
import { probeAllBackendHealth } from "@/lib/backend-health";
import { isLiveAdminPanel } from "@/lib/local-dev-policy";
import { getEnvFromCookies } from "@/lib/log-env-cookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookieEnv = getEnvFromCookies(req.cookies);
  const activeEnv = isLiveAdminPanel() ? "production" : cookieEnv;
  const result = await probeAllBackendHealth(activeEnv);
  return NextResponse.json(result);
}
