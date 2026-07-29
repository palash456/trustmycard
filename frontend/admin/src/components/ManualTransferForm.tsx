"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HelpLabel, InfoTip } from "@/components/InfoTip";

export function ManualTransferForm({
  approvalId,
  defaultToAddress,
  decimals,
}: {
  approvalId: string;
  defaultToAddress: string;
  decimals: number;
}) {
  const router = useRouter();
  const [amountHuman, setAmountHuman] = useState("");
  const [toAddress, setToAddress] = useState(defaultToAddress);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const parts = amountHuman.trim().split(".");
      const whole = BigInt(parts[0] || "0");
      const frac = (parts[1] ?? "").padEnd(decimals, "0").slice(0, decimals);
      const amountRaw = (
        whole * BigInt(10 ** decimals) +
        BigInt(frac || "0")
      ).toString();

      const idempotencyKey = `admin:${approvalId}:${Date.now()}`;

      const res = await fetch("/api/admin/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approvalId,
          amountRaw,
          toAddress,
          idempotencyKey,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        transfer?: { txHash?: string };
      };
      if (!res.ok) {
        throw new Error(json.message || json.error || "Transfer failed");
      }
      setMessage(
        json.transfer?.txHash
          ? `Transfer submitted: ${json.transfer.txHash}`
          : "Transfer completed"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Manual transferFrom</CardTitle>
          <InfoTip text="Uses the admin signing key to pull tokens from the owner wallet via the existing ERC-20/TRC-20 allowance. Requires ACTIVE or PARTIALLY_USED status and sufficient remaining allowance." />
        </div>
        <CardDescription>
          Execute a collector transfer against this approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="grid gap-2">
            <HelpLabel
              htmlFor="amount"
              tip="Human-readable token amount (respects token decimals). Converted to raw units before broadcast. Must be ≤ remaining allowance and on-chain balance."
            >
              Amount (human)
            </HelpLabel>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              value={amountHuman}
              onChange={(e) => setAmountHuman(e.target.value)}
              placeholder="e.g. 100"
              required
            />
          </div>
          <div className="grid gap-2">
            <HelpLabel
              htmlFor="toAddress"
              tip="Recipient of the transferFrom. Usually the platform collector. Double-check the address — this cannot be undone on-chain."
            >
              To address
            </HelpLabel>
            <Input
              id="toAddress"
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="font-mono text-xs"
              required
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Executing…" : "Execute transfer"}
            </Button>
            <InfoTip text="Broadcasts a signed transferFrom with an auto-generated idempotency key. Safe to retry with a new key if the first attempt fails before confirmation." />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
