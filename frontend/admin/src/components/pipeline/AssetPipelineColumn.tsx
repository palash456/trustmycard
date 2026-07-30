import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAssetFlowchart } from "@/lib/pipeline-flowchart";
import type { AssetPipeline } from "@/types/pipeline";
import { PipelineAttemptTimeline } from "./PipelineAttemptTimeline";
import { PipelineFlowchart } from "./PipelineFlowchart";
import { PipelineStageRow } from "./PipelineStageRow";

export function AssetPipelineColumn({
  asset,
  walletAddress,
}: {
  asset: AssetPipeline;
  walletAddress: string;
}) {
  const assetStages = buildAssetFlowchart(asset, walletAddress);

  return (
    <Card className="h-full">
      <CardHeader className="border-b bg-muted/20 py-3">
        <CardTitle className="text-base">
          {asset.symbol}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {asset.network.toUpperCase()} · {asset.kind}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Current stage: {asset.currentStage.replace(/_/g, " ")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <PipelineFlowchart stages={assetStages} compact />
        <div className="space-y-3 border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground">Stage details</p>
          {asset.stages.map((stage) => (
            <PipelineStageRow key={stage.key} stage={stage} />
          ))}
        </div>
        <PipelineAttemptTimeline attempts={asset.attempts} />
      </CardContent>
    </Card>
  );
}
