import type { NextRequest } from "next/server";

import { sha256Hex } from "./crypto";

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function createClientBinding(
  request: NextRequest,
): Promise<string> {
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  return sha256Hex(`${ip}|${userAgent}`);
}
