import type { NextRequest } from "next/server";

import { clientIp } from "./client-binding";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(
  request: NextRequest,
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const bucket = `${key}:${clientIp(request)}`;
  const now = Date.now();
  const entry = attempts.get(bucket);
  if (!entry || now > entry.resetAt) {
    attempts.set(bucket, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > maxAttempts;
}
