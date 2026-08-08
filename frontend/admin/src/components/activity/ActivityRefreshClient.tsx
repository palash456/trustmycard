"use client";

import { useAdminStream } from "@/hooks/use-admin-stream";

/** Auto-refresh activity feed when the active backend emits pipeline events. */
export function ActivityRefreshClient() {
  useAdminStream(true);
  return null;
}
