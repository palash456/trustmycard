import { Fragment } from "react";
import { tokenSymbolColorClass } from "@/lib/entity-colors";
import { parseTokenSymbols } from "@/lib/token-symbols";
import { cn } from "@/lib/utils";

export function TokenSymbol({
  symbol,
  className,
  uppercase = true,
}: {
  symbol: string;
  className?: string;
  uppercase?: boolean;
}) {
  const label = uppercase ? symbol.trim().toUpperCase() : symbol.trim();
  return (
    <span
      className={cn("font-medium", tokenSymbolColorClass(symbol), className)}
      title={label}
    >
      {label}
    </span>
  );
}

/** Renders one or more tokens with fixed USDT / USDC / native colors. */
export function TokenSymbolList({
  value,
  className,
  empty = "—",
}: {
  value?: string | null;
  className?: string;
  empty?: string;
}) {
  const tokens = value ? parseTokenSymbols(value) : [];
  if (tokens.length === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {empty}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs",
        className,
      )}
    >
      {tokens.map((symbol, index) => (
        <Fragment key={`${symbol}-${index}`}>
          {index > 0 ? (
            <span className="text-muted-foreground/70">,</span>
          ) : null}
          <TokenSymbol symbol={symbol} className="text-xs" />
        </Fragment>
      ))}
    </span>
  );
}
