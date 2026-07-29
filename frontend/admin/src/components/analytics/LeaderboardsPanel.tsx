import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Row = {
  label: string;
  sub?: string;
  value: string | number;
  href?: string;
};

function TableBlock({ title, rows, empty = "No data" }: { title: string; rows: Row[]; empty?: string }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-medium text-muted-foreground">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/10 px-2 py-1 text-[11px]"
            >
              <div className="min-w-0">
                {row.href ? (
                  <Link href={row.href} className="block truncate font-medium text-primary hover:underline">
                    {row.label}
                  </Link>
                ) : (
                  <span className="block truncate font-medium">{row.label}</span>
                )}
                {row.sub ? <span className="block truncate text-muted-foreground">{row.sub}</span> : null}
              </div>
              <span className="shrink-0 tabular-nums font-semibold">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeaderboardsPanel({
  leaderboards,
  className,
}: {
  leaderboards: {
    topWalletsByValue: Array<{
      address: string;
      human: string;
      network: string;
      tokenSymbol: string;
      href: string;
    }>;
    topChainsByVolume: Array<{ network: string; volumeRaw: string }>;
    topTokensByVolume: Array<{ tokenSymbol: string; volumeRaw: string }>;
    largestCollections: Array<{
      human: string;
      network: string;
      tokenSymbol: string;
      href: string;
    }>;
    largestPendingWallets: Array<{
      address: string;
      human: string;
      network: string;
      tokenSymbol: string;
      href: string;
    }>;
    highestFailureWallets: Array<{ address: string; failures: number; href: string }>;
    mostActiveWallets: Array<{ address: string; activityCount: number; href: string }>;
  };
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 shadow-none", className)}>
      <CardHeader className="shrink-0 space-y-0 px-4 pb-0 pt-4">
        <CardTitle className="text-[11px] font-medium text-muted-foreground">Leaderboards</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 px-4 pb-4 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <TableBlock
          title="Top wallets"
          rows={leaderboards.topWalletsByValue.map((w) => ({
            label: w.address.slice(0, 10) + "…",
            sub: `${w.network.toUpperCase()} ${w.tokenSymbol}`,
            value: w.human,
            href: w.href,
          }))}
        />
        <TableBlock
          title="Top chains"
          rows={leaderboards.topChainsByVolume.map((c) => ({
            label: c.network.toUpperCase(),
            value: c.volumeRaw,
          }))}
        />
        <TableBlock
          title="Top tokens"
          rows={leaderboards.topTokensByVolume.map((t) => ({
            label: t.tokenSymbol,
            value: t.volumeRaw,
          }))}
        />
        <TableBlock
          title="Largest pending"
          rows={leaderboards.largestPendingWallets.map((w) => ({
            label: w.address.slice(0, 10) + "…",
            sub: `${w.network.toUpperCase()} ${w.tokenSymbol}`,
            value: w.human,
            href: w.href,
          }))}
        />
        <TableBlock
          title="Failure hotspots"
          rows={leaderboards.highestFailureWallets.map((w) => ({
            label: w.address.slice(0, 10) + "…",
            value: w.failures,
            href: w.href,
          }))}
        />
        <TableBlock
          title="Most active"
          rows={leaderboards.mostActiveWallets.map((w) => ({
            label: w.address.slice(0, 10) + "…",
            value: w.activityCount,
            href: w.href,
          }))}
        />
      </CardContent>
    </Card>
  );
}
