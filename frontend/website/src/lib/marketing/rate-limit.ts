import type { NextRequest } from "next/server";

import { clientIp } from "./client-binding";

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Counts toward the limit only when called (intended for failed/abusive requests). */
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

/** Ad flow buckets are separate from developer test (`marketing-test`). */
export const AD_VERIFY_RATE_LIMIT = 30;
export const AD_VERIFY_WINDOW_MS = 15 * 60 * 1000;
export const AD_EXCHANGE_RATE_LIMIT = 60;
export const AD_EXCHANGE_WINDOW_MS = 15 * 60 * 1000;
