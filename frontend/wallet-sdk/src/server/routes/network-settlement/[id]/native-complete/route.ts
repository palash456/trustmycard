import { NextRequest } from "next/server";
import { proxyBackendPost } from "../../../../proxy-backend-api";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyBackendPost(
    req,
    `/v1/api/network-settlement/${encodeURIComponent(id)}/native-complete`,
  );
}
