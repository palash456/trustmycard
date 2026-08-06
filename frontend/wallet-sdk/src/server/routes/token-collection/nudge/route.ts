import { NextRequest } from "next/server";
import { proxyBackendPost } from "../../../proxy-backend-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return proxyBackendPost(req, "/v1/api/token-collection/nudge");
}
