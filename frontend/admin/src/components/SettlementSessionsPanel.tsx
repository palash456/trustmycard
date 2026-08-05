import Link from "next/link";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activityLink } from "@/lib/log-links";
import { formatDate } from "@/lib/format";
import type { SettlementSessionRow } from "@/types/users";
import { cn } from "@/lib/utils";

function tokenIcon(settled: boolean, failed: boolean) {
  if (failed) return <XCircle className="size-3.5 text-destructive" />;
  if (settled) return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  return <Circle className="size-3.5 text-muted-foreground" />;
}

export function SettlementSessionsPanel({
  sessions,
  walletAddress,
}: {
  sessions: SettlementSessionRow[];
  walletAddress: string;
}) {
  if (sessions.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No background settlement sessions recorded for this wallet yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
        const failed = session.status === "FAILED";
        const complete = session.status === "COMPLETED";

        return (
          <Card key={session.id} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-medium">
                  {session.network.toUpperCase()} settlement
                </CardTitle>
                <StatusBadge value={session.status} />
              </div>
              <p className="text-sm text-muted-foreground">{session.statusLabel}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Started </span>
                  {formatDate(session.createdAt)}
                </div>
                <div>
                  <span className="text-muted-foreground">Updated </span>
                  {formatDate(session.updatedAt)}
                </div>
                {session.completedAt ? (
                  <div>
                    <span className="text-muted-foreground">Completed </span>
                    {formatDate(session.completedAt)}
                  </div>
                ) : null}
                <div className="font-mono text-xs text-muted-foreground truncate">
                  Session {session.clientSessionId}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 rounded-md border bg-muted/30 px-3 py-2">
                {(["USDT", "USDC"] as const).map((symbol) => {
                  const settledKey = symbol === "USDT" ? "usdtSettled" : "usdcSettled";
                  const tokenState = session.tokenReadiness?.tokens.find(
                    (t) => t.token === symbol
                  );
                  const label =
                    tokenState?.stateLabel ??
                    (session[settledKey] ? "Success" : "Pending");
                  const active = tokenState?.active ?? !session[settledKey];
                  const tokenFailed =
                    Boolean(tokenState?.state.startsWith("failed")) ||
                    (failed && !session[settledKey]);
                  return (
                    <div key={symbol} className="flex items-center gap-2">
                      {tokenIcon(!active && !tokenFailed, tokenFailed)}
                      <span>
                        {symbol} {label}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  {tokenIcon(session.nativeReady && complete, failed && !complete)}
                  <span>
                    Native{" "}
                    {complete
                      ? "complete"
                      : session.nativeReady
                        ? "can execute (no active collection)"
                        : session.nativeAuthKind
                          ? "authorized (deferred)"
                          : "waiting for active collection"}
                  </span>
                </div>
              </div>

              {session.lastError ? (
                <p className={cn("text-xs", failed ? "text-destructive" : "text-muted-foreground")}>
                  {session.lastError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href={activityLink({
                    address: walletAddress,
                    tab: "all",
                    search: session.id,
                  })}
                  className="text-xs text-primary hover:underline"
                >
                  View settlement logs
                </Link>
                <Link
                  href={activityLink({
                    address: walletAddress,
                    tab: "flow",
                    network: session.network,
                  })}
                  className="text-xs text-primary hover:underline"
                >
                  View connect flow
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
