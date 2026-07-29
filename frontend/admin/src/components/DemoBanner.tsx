"use client";

import { useDemo } from "@/components/DemoProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DemoBanner() {
  const { demo } = useDemo();
  if (!demo) return null;
  return (
    <Alert className="mb-4 border-amber-700/40 bg-amber-100 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertDescription>
        Demo mode — showing ~1 month of fictional usage data. Turn off Demo mode in the
        account menu to use live data.
      </AlertDescription>
    </Alert>
  );
}
