import { connection } from "next/server";
import { cookies } from "next/headers";
import { resolveActiveBackend } from "./admin-backend";
import { isDemoModeFromCookies } from "./log-env-cookie";
import { getDemoFixture } from "@/demo/fixtures";
import { adminFetch, buildQuery } from "./admin-api";

export { buildQuery };

export async function adminGetData<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  await connection();
  const cookieStore = await cookies();
  if (isDemoModeFromCookies(cookieStore)) {
    return getDemoFixture<T>(path);
  }
  return adminFetch<T>(path, init, resolveActiveBackend(cookieStore));
}

/** @deprecated use adminGetData — all pages now follow the active environment */
export const adminGetLogData = adminGetData;
