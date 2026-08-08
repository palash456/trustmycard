"use client";

import { useLogEnv } from "@/components/LogEnvProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LogEnvBanner() {
  const { isProduction, toggleEnabled } = useLogEnv();
  if (!toggleEnabled) return null;

  if (isProduction) {
    return (
      <Alert className="mb-4 border-sky-700/40 bg-sky-100 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
        <AlertDescription>
          Production environment — all pages read from the live API and database. Switch
          to Development in the account menu for local data.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-violet-700/40 bg-violet-100 text-violet-950 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
      <AlertDescription>
        Development environment — all pages read from your local backend at localhost:4000.
        Start it with{" "}
        <code className="rounded bg-violet-200/60 px-1 py-0.5 text-xs dark:bg-violet-500/20">
          cd backend && npm run start:dev
        </code>{" "}
        if you see connection errors.
      </AlertDescription>
    </Alert>
  );
}
