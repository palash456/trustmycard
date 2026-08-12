import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { walletAddressColorClass } from "@/lib/entity-colors";
import { shortAddress } from "@/lib/format";
import { pipelineUserPath } from "@/lib/pipeline-paths";
import { cn } from "@/lib/utils";

export type WalletAddressLinkProps = {
  address: string;
  className?: string;
  /** Where the link navigates — user profile or pipeline user hub. */
  profile?: "user" | "pipeline";
  showCopy?: boolean;
  truncate?: boolean;
  head?: number;
  tail?: number;
  colorize?: boolean;
};

function walletHref(address: string, profile: "user" | "pipeline"): string {
  return profile === "pipeline"
    ? pipelineUserPath(address)
    : `/users/${encodeURIComponent(address)}`;
}

export function WalletAddressLink({
  address,
  className,
  profile = "user",
  showCopy = false,
  truncate = true,
  head = 6,
  tail = 4,
  colorize = true,
}: WalletAddressLinkProps) {
  const label = truncate ? shortAddress(address, head, tail) : address;
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-0.5", className)}
    >
      <Link
        href={walletHref(address, profile)}
        className={cn(
          "font-mono text-xs hover:underline",
          truncate ? "truncate" : "whitespace-nowrap break-all",
          colorize ? walletAddressColorClass(address) : "text-primary",
        )}
        title={address}
      >
        {label}
      </Link>
      {showCopy ? <CopyButton value={address} variant="icon" /> : null}
    </span>
  );
}

/** Colored wallet text without navigation (e.g. page headers). */
export function WalletAddressText({
  address,
  className,
  colorize = true,
}: {
  address: string;
  className?: string;
  colorize?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono break-all",
        colorize ? walletAddressColorClass(address) : undefined,
        className,
      )}
      title={address}
    >
      {address}
    </span>
  );
}
