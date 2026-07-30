"use client";

import { useAdminStream } from "@/hooks/use-admin-stream";

/** Subscribes to admin SSE and refreshes server-rendered pages when pipeline data changes. */
export function AdminLiveRefresh() {
  useAdminStream(true);
  return null;
}
