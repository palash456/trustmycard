import Image from "next/image";
import { getNetworkMeta } from "@/lib/network-meta";
import { cn } from "@/lib/utils";

export function NetworkBadge({
  network,
  className,
  showLabel = true,
  iconClassName,
}: {
  network?: string | null;
  className?: string;
  showLabel?: boolean;
  iconClassName?: string;
}) {
  if (!network?.trim()) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  const meta = getNetworkMeta(network);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
      title={meta.label}
    >
      <Image
        src={meta.icon}
        alt=""
        width={14}
        height={14}
        className={cn("size-3.5 shrink-0 rounded-full", iconClassName)}
      />
      {showLabel ? <span>{meta.label}</span> : null}
    </span>
  );
}
