"use client";

import { useAdminStream } from "@/hooks/use-admin-stream";
import { useLogEnv } from "@/components/LogEnvProvider";

export function AuditRefreshClient({ tab }: { tab: string }) {
  const { isProduction } = useLogEnv();
  useAdminStream(tab === "admin" && !isProduction);
  return null;
}
