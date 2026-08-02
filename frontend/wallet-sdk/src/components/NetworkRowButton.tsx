import { statusLabel } from "../core/network-meta";
import type { NetworkRow, RowStatus } from "../types";

type NetworkRowButtonProps = {
  network: NetworkRow;
  status: RowStatus;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export function NetworkRowButton({
  network,
  status,
  selected,
  disabled,
  onSelect,
}: NetworkRowButtonProps) {
  const waiting = status === "waiting" || status === "finalizing";
  const approved = status === "approved";

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={[
          "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
          waiting || (selected && !approved)
            ? "border-[#0400FF] bg-[#0400FF]/5"
            : approved
              ? "border-emerald-200 bg-emerald-50"
              : "border-[#ECECEF] bg-white hover:border-neutral-300",
        ].join(" ")}
      >
        {waiting ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#0400FF] border-t-transparent" />
          </span>
        ) : approved ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white">
            ✓
          </span>
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: network.color }}
          >
            {network.letter}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#131520]">
            {network.name}{" "}
            <span className="font-normal text-[#6A6D81]">
              ({network.standard})
            </span>
          </span>
          <span
            className={[
              "mt-0.5 block text-xs",
              approved ? "font-medium text-emerald-600" : "text-[#6A6D81]",
            ].join(" ")}
          >
            {statusLabel(status)}
          </span>
        </span>

        {!waiting && !approved ? (
          <span className="text-lg text-neutral-300" aria-hidden>
            ›
          </span>
        ) : null}
      </button>
    </li>
  );
}
