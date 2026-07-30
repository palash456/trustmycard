import type { UserPipelineSnapshot } from "@/types/pipeline";
import { PipelineFlowchartSection } from "./PipelineFlowchartSection";
import { PipelineMetricsGrid } from "./PipelineMetricsGrid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PipelineLifecycleDashboard({
  pipeline,
}: {
  pipeline: UserPipelineSnapshot;
}) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30 px-6 py-4">
          <CardTitle className="text-base">Pipeline flowchart</CardTitle>
          <p className="text-sm text-muted-foreground">
            Top-to-bottom lifecycle · Three asset pipelines after approval · Hover any stage for full details
          </p>
        </CardHeader>
        <CardContent className="px-4 py-6 md:px-8">
          <PipelineFlowchartSection pipeline={pipeline} />
        </CardContent>
      </Card>

      <PipelineMetricsGrid metrics={pipeline.metrics} />
      <p className="text-xs text-muted-foreground">
        Snapshot generated {new Date(pipeline.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
