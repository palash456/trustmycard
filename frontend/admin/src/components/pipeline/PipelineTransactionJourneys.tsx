import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TransactionIdLink } from "@/components/TransactionIdLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { resolveTransactionId } from "@/lib/transaction-id";
import type { UserPipelineSnapshot } from "@/types/pipeline";

function collectIdsFromPipeline(pipeline: UserPipelineSnapshot): string[] {
  const ids = new Set<string>();

  for (const session of pipeline.settlementSessions ?? []) {
    const id = resolveTransactionId({
      clientSessionId: session.clientSessionId,
    });
    if (id) ids.add(id);
  }

  const walkStages = (
    stages: Array<{
      logQuery: UserPipelineSnapshot["walletLinked"]["logQuery"];
      metadata: Record<string, unknown>;
    }>,
  ) => {
    for (const stage of stages) {
      const id = resolveTransactionId(stage.logQuery, stage.metadata);
      if (id) ids.add(id);
    }
  };

  walkStages([pipeline.walletLinked]);
  for (const n of pipeline.networkApproved.networks) {
    walkStages([n]);
  }
  for (const asset of pipeline.assets) {
    walkStages(asset.stages);
  }

  return [...ids];
}

export function PipelineTransactionJourneys({
  pipeline,
}: {
  pipeline: UserPipelineSnapshot;
}) {
  const fromSessions = (pipeline.settlementSessions ?? []).map((s) => ({
    id: resolveTransactionId({ clientSessionId: s.clientSessionId })!,
    network: s.network,
    status: s.status,
    statusLabel: s.statusLabel,
    updatedAt: s.updatedAt,
    settlementId: s.id,
  }));

  const sessionIds = new Set(fromSessions.map((s) => s.id));
  const otherIds = collectIdsFromPipeline(pipeline).filter(
    (id) => !sessionIds.has(id),
  );

  if (fromSessions.length === 0 && otherIds.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-base">Transaction journeys</CardTitle>
        <p className="text-sm text-muted-foreground">
          Each flow-* ID is one end-to-end user attempt — hover pipeline stages
          for the same IDs
        </p>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {fromSessions.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <StatusBadge value={s.status} />
            <TransactionIdLink id={s.id} />
            <span className="text-xs text-muted-foreground">
              {s.network.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">
              {s.statusLabel}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDate(s.updatedAt)}
            </span>
            <Link
              href={`/settlement-sessions/${encodeURIComponent(s.settlementId)}`}
              className="text-xs text-primary hover:underline"
            >
              Settlement
            </Link>
          </div>
        ))}
        {otherIds.map((id) => (
          <div
            key={id}
            className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <TransactionIdLink id={id} />
            <span className="text-xs text-muted-foreground">
              From pipeline stage metadata
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
