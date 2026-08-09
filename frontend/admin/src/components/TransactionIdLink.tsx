import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { transactionDetailLink } from "@/lib/log-links";
import { shortTransactionId } from "@/lib/transaction-id";
import { cn } from "@/lib/utils";

export function TransactionIdLink({
  id,
  className,
  showCopy = true,
  truncate = true,
  token,
}: {
  id: string;
  className?: string;
  showCopy?: boolean;
  truncate?: boolean;
  token?: string | null;
}) {
  const label = truncate ? shortTransactionId(id) : id;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1", className)}>
      <Link
        href={transactionDetailLink(id, { token })}
        className="truncate font-mono text-xs text-primary hover:underline"
        title={id}
      >
        {label}
      </Link>
      {showCopy ? <CopyButton value={id} /> : null}
    </span>
  );
}
