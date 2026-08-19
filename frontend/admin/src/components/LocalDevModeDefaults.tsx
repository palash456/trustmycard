"use client";

import { useEffect } from "react";
import { useDemo } from "@/components/DemoProvider";
import { useLogEnv } from "@/components/LogEnvProvider";

/** On local admin, keep data source on Dev (local backend) unless production logs are opted in. */
export function LocalDevModeDefaults({
  productionLogSourceEnabled,
}: {
  productionLogSourceEnabled: boolean;
}) {
  const { logEnv, setLogEnv } = useLogEnv();

  useEffect(() => {
    if (productionLogSourceEnabled) return;
    if (logEnv !== "production") return;
    setLogEnv("dev");
  }, [logEnv, productionLogSourceEnabled, setLogEnv]);

  return null;
}

/** On deployed admin, default log-env cookie to Production (never Development). */
export function LiveAdminModeDefaults() {
  const { demo } = useDemo();
  const { logEnv, setLogEnv } = useLogEnv();

  useEffect(() => {
    if (demo) return;
    if (logEnv === "production") return;
    setLogEnv("production");
  }, [demo, logEnv, setLogEnv]);

  return null;
}
