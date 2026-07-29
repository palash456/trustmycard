"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ReconcileButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/native-transfers/${id}/reconcile`, {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.message || json.error || "Failed");
      setMessage("Reconciliation triggered");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={busy} onClick={() => void run()}>
        {busy ? "Reconciling…" : "Reconcile now"}
      </Button>
      <InfoTip text="Fetches the on-chain receipt for this pending native transfer and marks it confirmed or failed. Use when automatic reconcile is lagged or stuck." />
      {message ? (
        <Alert className="max-w-md py-2">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
