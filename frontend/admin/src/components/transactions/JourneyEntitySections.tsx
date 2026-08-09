import Link from "next/link";
import { entityRouteId, entityDisplayId } from "@/lib/entity-ref";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { blockExplorerTx, formatDate } from "@/lib/format";
import type { TransactionJourneyDetail } from "@/types/transaction-journey";

function EntityTable({
  title,
  empty,
  children,
  hasItems,
}: {
  title: string;
  empty: string;
  hasItems: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {hasItems ? (
          children
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function JourneyEntitySections({
  data,
  network,
}: {
  data: TransactionJourneyDetail;
  network: string | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EntityTable
        title={`Approvals (${data.approvals.length})`}
        empty="No approvals linked to this transaction"
        hasItems={data.approvals.length > 0}
      >
        <ul className="space-y-2 text-sm">
          {data.approvals.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              <StatusBadge value={a.status} />
              <Link
                href={`/approvals/${entityRouteId(a)}`}
                className="font-medium text-primary hover:underline"
              >
                {a.publicId ?? `${a.network.toUpperCase()} ${a.tokenSymbol}`}
              </Link>
              {a.txHash ? (
                <a
                  href={blockExplorerTx(a.network, a.txHash) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-primary hover:underline"
                >
                  tx
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </EntityTable>

      <EntityTable
        title={`Collection intents (${data.collectionIntents.length})`}
        empty="No collection intents for this transaction"
        hasItems={data.collectionIntents.length > 0}
      >
        <ul className="space-y-2 text-sm">
          {data.collectionIntents.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              <StatusBadge value={c.status} />
              <span className="font-mono text-xs">{entityDisplayId(c)}</span>
              <span>
                {c.network.toUpperCase()} {c.tokenSymbol}
              </span>
              <Link
                href={`/approvals/${c.approvalId}`}
                className="text-xs text-primary hover:underline"
              >
                approval
              </Link>
            </li>
          ))}
        </ul>
      </EntityTable>

      <EntityTable
        title={`Collection transfers (${data.transfers.length})`}
        empty="No token collection transfers for this transaction"
        hasItems={data.transfers.length > 0}
      >
        <ul className="space-y-2 text-sm">
          {data.transfers.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              <StatusBadge value={t.status} />
              <Link
                href={`/transfers/${entityRouteId(t)}`}
                className="font-medium text-primary hover:underline"
              >
                {t.publicId ?? `${t.network.toUpperCase()} ${t.tokenSymbol}`}
              </Link>
              {t.txHash ? (
                <a
                  href={blockExplorerTx(t.network, t.txHash) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-primary hover:underline"
                >
                  tx
                </a>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(t.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </EntityTable>

      <EntityTable
        title={`Connect events (${data.tgEvents.length})`}
        empty="No Telegram / connect events for this transaction"
        hasItems={data.tgEvents.length > 0}
      >
        <ul className="space-y-2 text-sm">
          {data.tgEvents.map((e) => (
            <li key={e.id} className="rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={e.status} />
                <span className="font-medium">{e.type}</span>
                <span className="text-xs text-muted-foreground">
                  {e.network.toUpperCase()}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(e.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </EntityTable>

      <EntityTable
        title={`Native transfers (${data.nativeTransfers.length})`}
        empty="No native transfers for this transaction"
        hasItems={data.nativeTransfers.length > 0}
      >
        <ul className="space-y-2 text-sm">
          {data.nativeTransfers.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              <StatusBadge value={n.status} />
              <Link
                href={`/native-transfers/${entityRouteId(n)}`}
                className="font-medium text-primary hover:underline"
              >
                {n.publicId ?? n.network.toUpperCase()}
              </Link>
              {n.txHash ? (
                <a
                  href={blockExplorerTx(n.network, n.txHash) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {n.txHash.slice(0, 10)}…
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </EntityTable>

      {data.txHashes.length > 0 ? (
        <Card className="border-border/60 shadow-none lg:col-span-2">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-medium">
              Blockchain transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 text-sm">
            {data.txHashes.map((hash) => {
              const explorer = network ? blockExplorerTx(network, hash) : null;
              return (
                <div key={hash} className="font-mono text-xs">
                  {explorer ? (
                    <a
                      href={explorer}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {hash}
                    </a>
                  ) : (
                    hash
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
