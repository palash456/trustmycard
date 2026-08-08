"use client";

import { useAdminStream } from "@/hooks/use-admin-stream";

export function AuditRefreshClient({ tab }: { tab: string }) {
  useAdminStream(tab === "admin");
  return null;
}
