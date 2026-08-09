"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/components/DemoProvider";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SystemPanel({ status }: { status: Record<string, unknown> }) {
  const router = useRouter();
  const { demo } = useDemo();
  const [message, setMessage] = useState<string | null>(null);
  const devOpsEnabled = Boolean(status.devOpsEnabled);

  async function restart(path: string) {
    if (demo) {
      setMessage(`Demo: ${path} simulated`);
      return;
    }
    const res = await fetch(`/api/admin/dev/${path}`, { method: "POST" });
    const json = (await res.json()) as { message?: string; error?: string };
    if (!res.ok) throw new Error(json.error || "Failed");
    setMessage(json.message ?? "Restart initiated");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Secrets metadata</CardTitle>
            <InfoTip text="Shows whether admin signing keys are configured and whether they match the public spender addresses. Private keys are never displayed or editable here." />
          </div>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-foreground">
            {JSON.stringify(status.secrets, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Workers</CardTitle>
            <InfoTip text="Health of the approval collector and native reconcile schedulers after the last config reload." />
          </div>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-foreground">
            {JSON.stringify(
              {
                collector: status.collector,
                nativeReconcile: status.nativeReconcile,
              },
              null,
              2,
            )}
          </pre>
        </CardContent>
      </Card>

      {devOpsEnabled ? (
        <Card className="border-amber-600/40 shadow-sm dark:border-amber-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Dev ops</CardTitle>
              <InfoTip text="Local development only. Sends a restart signal to backend or website processes. Disabled in production and when ADMIN_DEV_OPS is not true." />
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button
              variant="destructive"
              onClick={() => void restart("restart-backend")}
            >
              Restart backend
            </Button>
            <InfoTip text="Signals the Nest API process to restart (dev helper). Prefer Settings → Save for config hot-reload when possible." />
            <Button
              variant="outline"
              onClick={() => void restart("restart-website")}
            >
              Restart website
            </Button>
            <InfoTip text="Signals the Next.js website process to restart so it picks up env or public settings changes that are not hot-reloaded." />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Dev restart disabled. Set ADMIN_DEV_OPS=true in backend .env
          (non-production only).
        </p>
      )}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
