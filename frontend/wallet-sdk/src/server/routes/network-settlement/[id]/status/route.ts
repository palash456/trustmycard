import { NextRequest } from "next/server";
import { proxyBackendGet } from "../../../../proxy-backend-api";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyBackendGet(
    req,
    `/v1/api/network-settlement/${encodeURIComponent(id)}/status`,
    { forwardAuthorization: false },
  );
}
