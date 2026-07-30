import Link from "next/link";
import { activityLink } from "@/lib/log-links";
import type { LogLinkParams } from "@/types/pipeline";

export function PipelineStageLogsLink({
  logQuery,
  className,
}: {
  logQuery: LogLinkParams;
  className?: string;
}) {
  return (
    <Link
      href={activityLink({
        address: logQuery.walletAddress,
        network: logQuery.network ?? logQuery.search,
        tab: logQuery.tab ?? "all",
        type: logQuery.type ?? logQuery.module ?? logQuery.action,
        search: logQuery.txHash ?? logQuery.sessionId,
      })}
      className={className ?? "text-xs text-primary hover:underline"}
    >
      View logs
    </Link>
  );
}
