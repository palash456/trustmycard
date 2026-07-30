import Link from "next/link";
import { auditStructuredLink } from "@/lib/log-links";
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
      href={auditStructuredLink(logQuery)}
      className={className ?? "text-xs text-primary hover:underline"}
    >
      View logs
    </Link>
  );
}
