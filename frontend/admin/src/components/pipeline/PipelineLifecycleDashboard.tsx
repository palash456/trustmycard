import type { UserPipelineSnapshot } from "@/types/pipeline";
import type { PipelineAssetScope } from "@/lib/pipeline-scope";
import { formatPipelineScopeLabel } from "@/lib/pipeline-scope";
import { PipelineFlowchartSection } from "./PipelineFlowchartSection";
import { PipelineMetricsGrid } from "./PipelineMetricsGrid";
import { PipelineTransactionJourneys } from "./PipelineTransactionJourneys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PipelineLifecycleDashboard({
  pipeline,
  assetScope,
  showTransactionJourneys = true,
}: {
  pipeline: UserPipelineSnapshot;
  assetScope?: PipelineAssetScope | null;
  showTransactionJourneys?: boolean;
}) {
  const flowTitle = assetScope
    ? `${formatPipelineScopeLabel(assetScope)} pipeline`
    : "Pipeline flowchart";
  const flowDescription = assetScope
    ? "End-to-end lifecycle for this network and token — hover any stage for IDs, metadata, and log links"
    : "Wallet lifecycle by asset · Hover any stage for transaction IDs, entity metadata, and links";

  return (
    <div className="space-y-6">
      {showTransactionJourneys ? (
        <PipelineTransactionJourneys pipeline={pipeline} />
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30 px-6 py-4">
          <CardTitle className="text-base">{flowTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{flowDescription}</p>
        </CardHeader>
        <CardContent className="px-4 py-6 md:px-8">
          <PipelineFlowchartSection
            pipeline={pipeline}
            assetScope={assetScope}
          />
        </CardContent>
      </Card>

      <PipelineMetricsGrid metrics={pipeline.metrics} />
      <p className="text-xs text-muted-foreground">
        Snapshot generated {new Date(pipeline.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
