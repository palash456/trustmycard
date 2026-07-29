import Link from "next/link";
import { pipelineUserPath } from "@/lib/pipeline-paths";
import { ArrowDown, CheckCircle2, Coins, ArrowLeftRight } from "lucide-react";
import { WorkflowStageBadge } from "@/components/WorkflowStageBadge";
import { UserHealthBadge } from "@/components/UserHealthBadge";
import { cn } from "@/lib/utils";
import type { WorkflowStage, HealthStatus } from "@/types/users";

const STAGES = [
  { key: "approval", label: "Approval", icon: CheckCircle2 },
  { key: "transfer", label: "Transfer", icon: ArrowLeftRight },
  { key: "native", label: "Native funding", icon: Coins },
  { key: "complete", label: "Completion", icon: CheckCircle2 },
] as const;

type UserContext = {
  address: string;
  workflowStage: WorkflowStage;
  healthStatus: HealthStatus;
  approvalStatus: string | null;
  transferStatus: string | null;
  nativeFundingStatus: string | null;
};

function stageIndex(stage: WorkflowStage): number {
  switch (stage) {
    case "idle":
    case "connected":
      return 0;
    case "approving":
    case "approved":
      return 1;
    case "collecting":
      return 2;
    case "native_pending":
      return 3;
    case "completed":
      return 4;
    case "failed":
      return -1;
    default:
      return 0;
  }
}

export function PipelineWorkflowStrip({
  owner,
  userContext,
}: {
  owner?: string;
  userContext?: UserContext | null;
}) {
  const activeIdx = userContext ? stageIndex(userContext.workflowStage) : null;
  const failed = userContext?.workflowStage === "failed";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Transaction lifecycle</p>
        {owner && userContext ? (
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowStageBadge value={userContext.workflowStage} />
            <UserHealthBadge value={userContext.healthStatus} />
            <Link
              href={pipelineUserPath(userContext.address)}
              className="text-xs text-primary hover:underline"
            >
              Open pipeline view →
            </Link>
          </div>
        ) : owner ? (
          <p className="text-xs text-muted-foreground">No user record for this address</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Search a wallet to trace its full pipeline
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-0">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = activeIdx !== null && !failed && i <= Math.min(activeIdx, 3);
          const isCurrent = activeIdx !== null && i === Math.min(activeIdx, 3) && !failed;
          const isFailed = failed && i === Math.max(0, (activeIdx ?? 0));

          return (
            <div key={stage.key} className="flex items-center">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                  isCurrent && "border-primary bg-primary/5 text-primary",
                  isActive && !isCurrent && "border-border bg-muted/50 text-foreground",
                  !isActive && !isFailed && "border-transparent text-muted-foreground",
                  isFailed && "border-destructive/50 bg-destructive/5 text-destructive"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{stage.label}</span>
              </div>
              {i < STAGES.length - 1 ? (
                <ArrowDown className="mx-1 size-3.5 rotate-[-90deg] text-muted-foreground/50 md:rotate-0" />
              ) : null}
            </div>
          );
        })}
      </div>

      {userContext ? (
        <div className="mt-3 grid gap-2 border-t pt-3 text-xs sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Approval: </span>
            <span>{userContext.approvalStatus ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Transfer: </span>
            <span>{userContext.transferStatus ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Native: </span>
            <span>{userContext.nativeFundingStatus ?? "—"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
