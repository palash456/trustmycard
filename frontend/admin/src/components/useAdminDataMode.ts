"use client";

import { useDemo } from "@/components/DemoProvider";
import { useLogEnv } from "@/components/LogEnvProvider";
import {
  getAdminDataModeMeta,
  resolveAdminDataMode,
  type AdminDataMode,
} from "@/lib/admin-data-mode";

export function useAdminDataMode(): {
  mode: AdminDataMode;
  meta: ReturnType<typeof getAdminDataModeMeta>;
  productionAvailable: boolean;
} {
  const { demo } = useDemo();
  const { logEnv, toggleEnabled: productionAvailable } = useLogEnv();
  const mode = resolveAdminDataMode({ demo, logEnv });
  return { mode, meta: getAdminDataModeMeta(mode), productionAvailable };
}
