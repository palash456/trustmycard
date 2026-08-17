import { resolveObservabilityDisplayStatus } from "@trustmycard/shared/observability";
import { ActivityStatusChip } from "@/components/activity/ActivityStatusChip";

type ObservabilityStatusInput = {
  status: string;
  stage?: string | null;
  operation?: string | null;
  module?: string | null;
  level?: string | null;
  context?: Record<string, unknown>;
};

export function ObservabilityStatusBadge({
  status,
  stage,
  operation,
  module,
  level,
  context,
}: ObservabilityStatusInput) {
  const displayStatus = resolveObservabilityDisplayStatus({
    status,
    stage,
    operation,
    module,
    level,
    context,
  });

  return <ActivityStatusChip status={displayStatus} />;
}
