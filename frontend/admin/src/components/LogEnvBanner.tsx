"use client";

import { useLogEnv } from "@/components/LogEnvProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LogEnvBanner() {
  const { isProduction, toggleEnabled } = useLogEnv();
  if (!toggleEnabled || !isProduction) return null;
  return (
    <Alert className="mb-4 border-sky-700/40 bg-sky-100 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
      <AlertDescription>
        Production logs — showing live data from the production API. Switch to Dev logs in
        the account menu to view your local backend.
      </AlertDescription>
    </Alert>
  );
}
