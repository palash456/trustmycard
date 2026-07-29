"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/components/DemoProvider";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CollectorPanel({ status }: { status: Record<string, unknown> }) {
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
          <CardTitle className="text-base">Collector status</CardTitle>
          <InfoTip text="Live view of the approval collector worker: whether it is running, interval/batch size, and last tick time." />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-foreground">
          {JSON.stringify(collector, null, 2)}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void post("collector/tick")}>Force tick</Button>
          <InfoTip text="Runs one collector pass immediately: finds due approvals per network and attempts transferFrom where allowance and balance allow." />
          <Button variant="outline" onClick={() => void post("collector/release-leases")}>
            Release leases
          </Button>
          <InfoTip text="Clears stuck network and approval leases so another worker can claim rows that appear locked after a crash or long RPC hang." />
          <Button
            variant="outline"
            onClick={() =>
              void post("collector/toggle", { enabled: !collector.effectiveEnabled })
            }
          >
            {collector.effectiveEnabled ? "Disable" : "Enable"} collector
          </Button>
          <InfoTip text="Runtime enable/disable for the collector without restarting the Nest process. Also persists collector.enabled in AppSettings." />
        </div>
        {message ? <p className="text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
