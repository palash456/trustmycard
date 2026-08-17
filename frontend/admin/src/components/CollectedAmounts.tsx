import { NetworkBadge } from "@/components/NetworkBadge";
import { TokenSymbol } from "@/components/TokenSymbol";
import { formatAdminAmount } from "@/lib/amount-display";
import type { CollectedTotal } from "@/types/transaction-journey";
export { formatInrValue } from "@trustmycard/shared/fx";

function TokenAmountRow({
  amount,
  tokenSymbol,
  network,
}: {
  amount: string;
  tokenSymbol: string;
  network: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      <span className="tabular-nums text-foreground">{amount}</span>
      <TokenSymbol symbol={tokenSymbol} className="text-xs" />
      <NetworkBadge network={network} />
    </span>
  );
}

export function CollectedAmounts({ items }: { items: CollectedTotal[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex max-w-md flex-wrap items-center gap-x-2 gap-y-1">
      {items.map((item, index) => (
        <span
          key={`${item.network}-${item.tokenSymbol}-${index}`}
          className="inline-flex items-center gap-2"
        >
          {index > 0 ? (
            <span className="text-muted-foreground/40">·</span>
          ) : null}
          <TokenAmountRow
            amount={formatAdminAmount(item.collectedHuman ?? item.collectedRaw)}
            tokenSymbol={item.tokenSymbol}
            network={item.network}
          />
        </span>
      ))}
    </span>
  );
}
