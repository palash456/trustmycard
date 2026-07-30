import Link from "next/link";
import { ScrollText } from "lucide-react";
import { auditStructuredLink, type LogLinkParams } from "@/lib/log-links";

export function ViewLogsLink({
  params,
  label = "View logs",
  className = "inline-flex items-center gap-1 text-xs text-primary hover:underline",
}: {
  params: LogLinkParams;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={auditStructuredLink(params)} className={className}>
      <ScrollText className="size-3" />
      {label}
    </Link>
  );
}
