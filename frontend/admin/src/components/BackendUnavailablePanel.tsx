"use client";

import { AlertCircle, FlaskConical, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BackendHealthResult } from "@/lib/backend-health";
import type { LogEnv } from "@/lib/log-env-cookie";
import { useBackendStatus } from "@/components/BackendStatusProvider";

export function BackendUnavailablePanel({
  active,
  activeEnv,
  productionConfigured,
}: {
  active: BackendHealthResult;
  activeEnv: LogEnv;
  productionConfigured: boolean;
}) {
  const { switchEnvironment, switchToDemo } = useBackendStatus();
  const isDev = activeEnv === "dev";

  return (
    <Card className="mx-auto max-w-xl border-destructive/30 shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <CardTitle className="text-lg">
            {isDev
              ? "Development server is not available"
              : "Production server is not available"}
          </CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed text-foreground/80">
          {active.error ??
            `The ${active.label} could not be reached at ${active.url || "the configured URL"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {isDev && productionConfigured ? (
          <Button type="button" onClick={() => switchEnvironment("production")}>
            <Server className="size-4" />
            Switch to production
          </Button>
        ) : null}
        {!isDev ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => switchEnvironment("dev")}
          >
            <Server className="size-4" />
            Switch to development
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={switchToDemo}>
          <FlaskConical className="size-4" />
          Switch to demo mode
        </Button>
      </CardContent>
    </Card>
  );
}
