import { cookies } from "next/headers";
import { resolveLogBackend } from "./admin-backend";
import { isDemoModeFromCookie } from "./demo-cookie";
import { getDemoFixture } from "@/demo/fixtures";
import { adminFetch, buildQuery } from "./admin-api";

export { buildQuery };

export async function adminGetData<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const cookieStore = await cookies();
  const demo = isDemoModeFromCookie(cookieStore.toString());
  if (demo) {
    return getDemoFixture<T>(path);
  }
  return adminFetch<T>(path, init);
}

/** Fetches log/observability data from dev or production backend per header toggle. */
export async function adminGetLogData<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const demo = isDemoModeFromCookie(cookieHeader);
  if (demo) {
    return getDemoFixture<T>(path);
  }
  return adminFetch<T>(path, init, resolveLogBackend(cookieHeader));
}
