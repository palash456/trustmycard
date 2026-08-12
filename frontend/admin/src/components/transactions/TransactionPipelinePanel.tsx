import Link from "next/link";
import type { UserPipelineSnapshot } from "@/types/pipeline";
import type { TransactionJourneyDetail } from "@/types/transaction-journey";
import { PipelineLifecycleDashboard } from "@/components/pipeline/PipelineLifecycleDashboard";
import { TokenSymbol } from "@/components/TokenSymbol";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { transactionIdColorClass } from "@/lib/entity-colors";
import {
  formatPipelineScopeLabel,
  resolveJourneyPipelineScope,
  scopePipelineToAsset,
  tokensForJourneyNetwork,
} from "@/lib/pipeline-scope";
import { cn } from "@/lib/utils";

export function TransactionPipelinePanel({
  pipeline,
  transactionId,
  journey,
  selectedToken,
}: {
  pipeline: UserPipelineSnapshot;
  transactionId: string;
  journey: Pick<
    TransactionJourneyDetail,
    | "approvals"
    | "transfers"
    | "collectionIntents"
    | "nativeTransfers"
    | "network"
    | "token"
  >;
  selectedToken?: string | null;
}) {
  const assetScope =
    resolveJourneyPipelineScope({
      journey,
      tokenOverride: selectedToken,
    }) ??
    (pipeline.assets.length === 1
      ? {
          network: pipeline.assets[0]!.network,
          token: pipeline.assets[0]!.symbol,
        }
      : null);
  const scopedPipeline = assetScope
    ? (scopePipelineToAsset(pipeline, assetScope) ?? pipeline)
    : pipeline;
  const availableTokens = tokensForJourneyNetwork(journey, journey.network);

  const hasStages =
    (scopedPipeline.settlementSessions?.length ?? 0) > 0 ||
    scopedPipeline.assets.some((a) => a.stages.length > 0);

  if (!hasStages) {
    return (
      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm font-medium">
            Pipeline for this transaction
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
          No pipeline stages are linked to{" "}
          <span className={cn("font-mono", transactionIdColorClass(transactionId))}>
            {transactionId}
          </span>{" "}
          yet. Open the
          wallet funnel for the full lifecycle.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">
          Pipeline for this transaction
        </h2>
        <p className="text-sm text-muted-foreground">
          {assetScope ? (
            <>
              Showing the{" "}
              <span className="font-medium">
                {formatPipelineScopeLabel(assetScope)}
              </span>{" "}
              flow for{" "}
              <span
                className={cn(
                  "font-mono text-xs",
                  transactionIdColorClass(transactionId),
                )}
              >
                {transactionId}
              </span>
            </>
          ) : (
            <>
              Stages scoped to{" "}
              <span
                className={cn(
                  "font-mono text-xs",
                  transactionIdColorClass(transactionId),
                )}
              >
                {transactionId}
              </span>{" "}
              —
              select a token below when multiple assets were involved
            </>
          )}
        </p>
      </div>

      {availableTokens.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {availableTokens.map((token) => {
            const active =
              assetScope?.token.toUpperCase() === token.toUpperCase() ||
              (!assetScope &&
                selectedToken?.toUpperCase() === token.toUpperCase());
            return (
              <Link
                key={token}
                href={`/transactions/${encodeURIComponent(transactionId)}?token=${encodeURIComponent(token)}`}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                <TokenSymbol symbol={token} />
              </Link>
            );
          })}
        </div>
      ) : null}

      <PipelineLifecycleDashboard
        pipeline={scopedPipeline}
        assetScope={assetScope}
        showTransactionJourneys={false}
      />
    </div>
  );
}
