"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/components/DemoProvider";
import { HelpLabel, InfoTip } from "@/components/InfoTip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ApprovalControls({
  approvalId,
  collectionEnabled,
  collectionToAddress,
}: {
  approvalId: string;
  collectionEnabled: boolean;
  collectionToAddress: string | null;
}) {
  const router = useRouter();
  const { demo } = useDemo();
  const [enabled, setEnabled] = useState(collectionEnabled);
  const [toAddress, setToAddress] = useState(collectionToAddress ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    if (demo) {
      setMessage("Demo: settings saved (simulated)");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          collectionEnabled: enabled,
          collectionToAddress: toAddress || null,
        }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.message || json.error || "Failed");
      setMessage("Approval updated");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Collection controls</CardTitle>
          <InfoTip text="Pause or resume automatic collection for this approval, and optionally override where collected tokens are sent." />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Collection enabled
          <InfoTip text="When unchecked, the collector skips this approval until you turn it back on. Useful to pause a wallet without revoking the on-chain allowance." />
        </label>
        <div className="grid gap-2">
          <HelpLabel
            htmlFor="collectionTo"
            tip="Destination for transferFrom. Defaults to the platform spender/collector. Change only if you intentionally route to another controlled address."
          >
            Collection destination
          </HelpLabel>
          <Input
            id="collectionTo"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save collection settings"}
          </Button>
          <InfoTip text="Persists collectionEnabled and destination on this approval and writes an audit log entry." />
        </div>
      </CardContent>
    </Card>
  );
}
