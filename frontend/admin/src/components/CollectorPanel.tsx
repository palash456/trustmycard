"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/components/DemoProvider";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CollectorPanel({
  status,
  collection,
}: {
  status: Record<string, unknown>;
  collection?: Record<string, unknown>;
}) {
  const router = useRouter();
  const { demo } = useDemo();
  const [message, setMessage] = useState<string | null>(null);
  const collector = (status.collector ?? {}) as Record<string, unknown>;

  async function post(path: string, body?: object) {
    if (demo) {
      setMessage(`Demo: ${path} simulated`);
      return;
    }
    const res = await fetch(`/api/admin/${path}`, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error || "Request failed");
    }
    setMessage("Done");
    router.refresh();
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Collection worker status</CardTitle>
          <InfoTip text="Live view of legacy collector compatibility state plus event-driven outbox, queue and collection-intent health." />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-foreground">
          {JSON.stringify(
            {
              backgroundJobs: status.backgroundJobs,
              collector,
              collection,
            },
            null,
            2,
          )}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void post("collections/recover")}>
            Run recovery
          </Button>
          <InfoTip text="Replays pending transactional outbox events. Normal queue-mode collection is never performed by this recovery action." />
          {!collection ? (
            <>
              <Button
                variant="outline"
                onClick={() => void post("collector/release-leases")}
              >
                Release leases
              </Button>
              <InfoTip text="Legacy polling compatibility operation. Queue-mode recovery uses outbox replay instead." />
              <Button
                variant="outline"
                onClick={() =>
                  void post("collector/toggle", {
                    enabled: !collector.effectiveEnabled,
                  })
                }
              >
                {collector.effectiveEnabled ? "Disable" : "Enable"} collector
              </Button>
            </>
          ) : null}
        </div>
        {message ? <p className="text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
