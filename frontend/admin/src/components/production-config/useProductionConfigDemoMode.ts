"use client";

import { useDemo } from "@/components/DemoProvider";
import { useLogEnv } from "@/components/LogEnvProvider";
import { isLocalAdminDevelopment } from "@/lib/local-dev-policy";

/** Production config preview: global demo, or local admin on Development data source. */
export function useProductionConfigDemoMode(): boolean {
  const { demo } = useDemo();
  const { logEnv } = useLogEnv();

  if (demo) return true;
  return isLocalAdminDevelopment() && logEnv === "dev";
}
