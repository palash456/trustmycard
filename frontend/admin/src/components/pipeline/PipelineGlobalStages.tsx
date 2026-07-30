import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  pipelineStageStatusLabel,
  type NetworkApprovedEntry,
  type WalletLinkedStage,
} from "@/types/pipeline";
import { PipelineStageLogsLink } from "./PipelineStageLogsLink";
import { cn } from "@/lib/utils";

function statusBadge(status: string): string {
  switch (status) {
    case "success":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "running":
      return "bg-primary/15 text-primary";
    case "failed":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function GlobalStageCard({
  title,
  status,
  metadata,
  logQuery,
  at,
}: {
  title: string;
  status: string;
  metadata: Record<string, unknown>;
  logQuery: WalletLinkedStage["logQuery"];
  at?: string;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
              statusBadge(status)
            )}
          >
            {pipelineStageStatusLabel(status as WalletLinkedStage["status"])}
          </span>
        </div>
        {at ? (
          <p className="text-xs text-muted-foreground">
            {new Date(at).toLocaleString()}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 pb-4 text-xs">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{key}</span>
            <span className="truncate font-mono">{String(value)}</span>
          </div>
        ))}
        <PipelineStageLogsLink logQuery={logQuery} />
      </CardContent>
    </Card>
  );
}

function NetworkCard({ entry }: { entry: NetworkApprovedEntry }) {
  return (
    <div className="rounded-md border p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold uppercase">{entry.network}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] uppercase", statusBadge(entry.status))}>
          {pipelineStageStatusLabel(entry.status)}
        </span>
      </div>
      {entry.approvalStatus ? (
        <p className="text-muted-foreground">Approval: {entry.approvalStatus}</p>
      ) : null}
      <div className="mt-2">
        <PipelineStageLogsLink logQuery={entry.logQuery} />
      </div>
    </div>
  );
}

export function PipelineGlobalStages({
  walletLinked,
  networkApproved,
}: {
  walletLinked: WalletLinkedStage;
  networkApproved: { networks: NetworkApprovedEntry[] };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlobalStageCard
        title="Wallet linked"
        status={walletLinked.status}
        metadata={walletLinked.metadata}
        logQuery={walletLinked.logQuery}
        at={walletLinked.at}
      />
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Network approved</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pb-4 sm:grid-cols-2">
          {networkApproved.networks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No approvals yet.</p>
          ) : (
            networkApproved.networks.map((entry) => (
              <NetworkCard key={entry.network} entry={entry} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
