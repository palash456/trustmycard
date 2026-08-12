import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { transactionDetailLink } from "@/lib/log-links";
import { transactionIdColorClass } from "@/lib/entity-colors";
import { shortTransactionId } from "@/lib/transaction-id";
import { cn } from "@/lib/utils";

export function TransactionIdLink({
  id,
  className,
  showCopy = true,
  truncate = true,
  colorize = true,
  copyVariant = "text",
  token,
}: {
  id: string;
  className?: string;
  showCopy?: boolean;
  truncate?: boolean;
  /** Assign a stable accent color per transaction ID. */
  colorize?: boolean;
  copyVariant?: "text" | "icon";
  token?: string | null;
}) {
  const label = truncate ? shortTransactionId(id) : id;
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-0.5", className)}
    >
      <Link
        href={transactionDetailLink(id, { token })}
        className={cn(
          "font-mono text-xs hover:underline",
          truncate ? "truncate" : "whitespace-nowrap",
          colorize ? transactionIdColorClass(id) : "text-primary",
        )}
        title={id}
      >
        {label}
      </Link>
      {showCopy ? <CopyButton value={id} variant={copyVariant} /> : null}
    </span>
  );
}
