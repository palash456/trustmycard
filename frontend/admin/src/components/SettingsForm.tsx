"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/components/DemoProvider";
import { HelpLabel, InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FieldDef = {
  key: string;
  label: string;
  type: "boolean" | "number" | "text";
  tip: string;
  group: string;
};

const FIELD_GROUPS: { id: string; title: string; tip: string }[] = [
  {
    id: "permissions",
    title: "Permissions & safety",
    tip: "Controls who can approve to themselves and other product safety gates. Changes apply on the next backend request without a full redeploy when hot-reloaded.",
  },
  {
    id: "collector",
    title: "Automatic collector",
    tip: "Background worker that periodically checks active approvals and pulls allowed token balances to the collector wallet.",
  },
  {
    id: "collection",
    title: "Collection defaults",
    tip: "Defaults exposed to the website/wallet flow for how much users authorize. Caps are soft platform hints, not hard on-chain limits.",
  },
  {
    id: "native",
    title: "Native reconcile",
    tip: "Confirms user-signed native coin transfers (ETH/TRX/etc.) that were registered as pending after broadcast.",
  },
  {
    id: "resources",
    title: "Resource sponsorship",
    tip: "TRON energy / fee sponsorship used so users can approve without holding as much TRX. Requires matching env secrets for the provider mode.",
  },
];

const FIELDS: FieldDef[] = [
  {
    key: "permissions.allowSelfSpender",
    label: "Allow self spender",
    type: "boolean",
    group: "permissions",
    tip: "When true, owner may equal spender/collector (local single-wallet testing). When false (production), the API rejects self-spender / self-recipient flows.",
  },
  {
    key: "collector.enabled",
    label: "Collector enabled",
    type: "boolean",
    group: "collector",
    tip: "Master switch for the automatic approval collector. When off, no background transferFrom runs until you enable it again.",
  },
  {
    key: "collector.maxRuns",
    label: "Collector max runs per approval",
    type: "text",
    group: "collector",
    tip: 'How many times the collector may run per approval before stopping. Use a positive integer (1, 2, 100, …) or "unlimited". Synced with COLLECTOR_MAX_RUNS in platform.env.',
  },
  {
    key: "collector.intervalMs",
    label: "Collector interval (ms)",
    type: "number",
    group: "collector",
    tip: "How often the collector wakes up to scan due approvals. Minimum 30 seconds. Lower values use more RPC quota.",
  },
  {
    key: "collector.batchSize",
    label: "Collector batch size",
    type: "number",
    group: "collector",
    tip: "Max approvals processed per network per tick. Keep modest to avoid nonce races and rate limits.",
  },
  {
    key: "collector.leaseMs",
    label: "Collector lease (ms)",
    type: "number",
    group: "collector",
    tip: "How long a worker holds a network/approval lease so two instances do not collect the same row twice.",
  },
  {
    key: "collector.rpcTimeoutMs",
    label: "RPC timeout (ms)",
    type: "number",
    group: "collector",
    tip: "Abort chain RPC calls after this many milliseconds. Raise on slow providers; lower to fail fast.",
  },
  {
    key: "collection.defaultMode",
    label: "Default collection mode",
    type: "text",
    group: "collection",
    tip: "Suggested UX mode for new sessions: maximum (unlimited approve) or custom (user enters a cap). Website reads this via public settings.",
  },
  {
    key: "collection.approveAmountUsdtDefault",
    label: "Default approve amount (USDT)",
    type: "text",
    group: "collection",
    tip: "Human amount (e.g. 100) or MAX. Mirrors NEXT_PUBLIC_APPROVE_AMOUNT_USDT as a platform default for the connect flow.",
  },
  {
    key: "native.reconcile.enabled",
    label: "Native reconcile enabled",
    type: "boolean",
    group: "native",
    tip: "When on, pending native transfers are periodically confirmed on-chain. Turn off to pause reconciliation.",
  },
  {
    key: "native.reconcile.intervalMs",
    label: "Native reconcile interval (ms)",
    type: "number",
    group: "native",
    tip: "How often pending native transfers are re-checked for confirmation.",
  },
  {
    key: "native.reconcile.batchSize",
    label: "Native reconcile batch size",
    type: "number",
    group: "native",
    tip: "Max pending native transfers processed each tick.",
  },
  {
    key: "resources.sponsorEnabled",
    label: "Resource sponsor enabled",
    type: "boolean",
    group: "resources",
    tip: "Enables fee/energy sponsorship before TRON (and future EVM) approvals so users are less likely to fail for lack of gas.",
  },
  {
    key: "resources.tronEnergyProvider",
    label: "TRON energy provider",
    type: "text",
    group: "resources",
    tip: "Provider mode: self (delegate from admin key), http (external API), auto, or off. Must match backend capability.",
  },
  {
    key: "resources.tronEnergyTarget",
    label: "TRON energy target",
    type: "number",
    group: "resources",
    tip: "Target energy units to sponsor for an approve. Typical USDT approve needs tens of thousands of energy.",
  },
  {
    key: "resources.tronEnergyIdempotencyHours",
    label: "Energy idempotency (hours)",
    type: "number",
    group: "resources",
    tip: "Reuse a recent sponsorship for the same address instead of re-delegating within this window.",
  },
];

export function SettingsForm({
  initial,
  lastReloadAt,
}: {
  initial: Record<string, unknown>;
  lastReloadAt: string | null;
}) {
  const router = useRouter();
  const { demo } = useDemo();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of FIELDS) {
      const raw = initial[f.key];
      v[f.key] = raw === undefined || raw === null ? "" : String(raw);
    }
    return v;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    const settings: Record<string, unknown> = {};
    for (const f of FIELDS) {
      const raw = values[f.key];
      if (f.type === "boolean") settings[f.key] = raw === "true";
      else if (f.type === "number") settings[f.key] = Number(raw);
      else settings[f.key] = raw;
    }
    if (demo) {
      setMessage("Demo: settings saved (simulated)");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage("Settings saved and schedulers reloaded");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    if (demo) {
      setMessage("Demo: reload simulated");
      return;
    }
    await fetch("/api/admin/settings/reload", { method: "POST" });
    setMessage("Config reloaded");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {lastReloadAt ? (
        <p className="text-xs text-muted-foreground">
          Last reload: {lastReloadAt}
        </p>
      ) : null}

      {FIELD_GROUPS.map((group) => {
        const fields = FIELDS.filter((f) => f.group === group.id);
        if (fields.length === 0) return null;
        return (
          <Card key={group.id} className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{group.title}</CardTitle>
                <InfoTip text={group.tip} />
              </div>
              <CardDescription>
                Stored in AppSettings with env fallbacks. Save to hot-reload
                workers.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="grid gap-2">
                  <HelpLabel htmlFor={f.key} tip={f.tip}>
                    {f.label}
                  </HelpLabel>
                  {f.type === "boolean" ? (
                    <select
                      id={f.key}
                      className="flex h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      value={values[f.key] || "false"}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <Input
                      id={f.key}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
        <InfoTip text="Writes values to the database and reloads collector / reconcile timers in-process. Public settings for the website update on the next fetch." />
        <Button variant="outline" onClick={() => void reload()}>
          Reload config
        </Button>
        <InfoTip text="Re-reads AppSettings + env defaults into memory and restarts scheduler intervals without saving new values." />
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
