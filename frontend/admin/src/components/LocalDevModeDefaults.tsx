"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLogEnv } from "@/components/LogEnvProvider";
import { safeRouterRefresh } from "@/lib/safe-router-refresh";

/** On local admin, keep data source on Dev (local backend) unless production logs are opted in. */
export function LocalDevModeDefaults({
  productionLogSourceEnabled,
}: {
  productionLogSourceEnabled: boolean;
}) {
  const router = useRouter();
  const { logEnv, setLogEnv } = useLogEnv();

  useEffect(() => {
    if (productionLogSourceEnabled) return;
    if (logEnv !== "production") return;
    setLogEnv("dev");
    safeRouterRefresh(router);
  }, [logEnv, productionLogSourceEnabled, router, setLogEnv]);

  return null;
}
