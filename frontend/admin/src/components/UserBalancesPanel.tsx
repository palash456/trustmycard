"use client";

import { useMemo, useState } from "react";
import { useDemo } from "@/components/DemoProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readAdminProxyError } from "@/lib/admin-proxy-client";
import { formatDate } from "@/lib/format";
import type { UnifiedActivityItem } from "@/types/activity-feed";
import type { UserBalances } from "@/types/users";

const DEMO_BALANCES: UserBalances = {
  eth: { native: "0.042", usdt: "125.50", usdc: "0" },
  bsc: { native: "0.18", usdt: "340.00", usdc: "50.25" },
  pol: { native: "12.5", usdt: "89.00", usdc: "0" },
  tron: { native: "450.2", usdt: "200.00", usdc: "15.00" },
};

const ELIGIBILITY_STEPS = new Set([
  "CHECK_ELIGIBILITY_STARTED",
  "CHECK_ELIGIBILITY_FETCH_SUCCESS",
  "CHECK_ELIGIBILITY_FETCH_FAILED",
  "CHECK_ELIGIBILITY_COMPLETE",
  "CHECK_ELIGIBILITY_FAILED",
  "NETWORK_REFRESH_STARTED",
  "NETWORK_REFRESH_SUCCESS",
  "NETWORK_REFRESH_FAILED",
  "ELIGIBILITY_GATE_BLOCKED",
]);

export function UserBalancesPanel({
  address,
  activityFeed = [],
}: {
  address: string;
  activityFeed?: UnifiedActivityItem[];
}) {
  const { demo } = useDemo();
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibilityEvents = useMemo(
    () =>
      activityFeed.filter((item) =>
        ELIGIBILITY_STEPS.has(item.step.trim().toUpperCase()),
      ),
    [activityFeed],
  );

  const latestEligibilityCheck = eligibilityEvents.find(
    (item) => item.step.trim().toUpperCase() === "CHECK_ELIGIBILITY_COMPLETE",
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 400));
        setBalances(DEMO_BALANCES);
        return;
      }
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(address)}/balances`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error(await readAdminProxyError(res, `HTTP ${res.status}`));
      }
      setBalances((await res.json()) as UserBalances);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load balances");
    } finally {
      setLoading(false);
    }
  }

  const networks = balances ? Object.keys(balances).sort() : [];

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Live on-chain balances</CardTitle>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Loading…" : balances ? "Refresh" : "Load balances"}
          </Button>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          ) : null}
          {!balances && !error ? (
            <p className="text-sm text-muted-foreground">
              Balances are fetched live from RPC on demand — not stored in the
              database.
            </p>
          ) : null}
          {balances ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Network</TableHead>
                  <TableHead>Native</TableHead>
                  <TableHead>USDT</TableHead>
                  <TableHead>USDC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {networks.map((network) => (
                  <TableRow key={network}>
                    <TableCell className="font-medium uppercase">
                      {network}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {balances[network].native}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {balances[network].usdt}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {balances[network].usdc}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Eligibility activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestEligibilityCheck ? (
            <p className="text-sm text-muted-foreground">
              Last eligibility check:{" "}
              <span className="font-medium text-foreground">
                {formatDate(latestEligibilityCheck.at)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No eligibility checks recorded in the loaded activity feed.
            </p>
          )}
          {eligibilityEvents.length > 0 ? (
            <div className="space-y-2">
              {eligibilityEvents.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.step}
                    {item.network ? ` · ${item.network.toUpperCase()}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
