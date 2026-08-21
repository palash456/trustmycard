import { NextResponse } from "next/server";
import { buildNetworkConfigFromEnv } from "@trustmycard/shared/constants/network-env-parsers";

export const dynamic = "force-dynamic";

/** Runtime network allowlist + minimum balances (matches /api/balances filtering). */
export async function GET() {
  return NextResponse.json(
    buildNetworkConfigFromEnv(
      process.env as Record<string, string | undefined>,
    ),
  );
}
