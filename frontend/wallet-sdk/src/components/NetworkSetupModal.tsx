import type { NetworkRow, RowStatus } from "../types";
import { NetworkRowButton } from "./NetworkRowButton";

type NetworkSetupModalProps = {
  networks: NetworkRow[];
  rowStatus: Record<string, RowStatus>;
  selectedKey: string | null;
  approving: boolean;
  error: string | null;
  onClose: () => void;
  onSelectNetwork: (key: string) => void;
  onContinue: () => void;
};

function continueLabel(
  selectedKey: string | null,
  rowStatus: Record<string, RowStatus>
): string {
  if (!selectedKey) return "Continue →";
  const status = rowStatus[selectedKey];
  if (status === "finalizing") return "Confirming...";
  if (status === "waiting") return "Waiting for confirmation...";
  return "Continue →";
}

export function NetworkSetupModal({
  networks,
  rowStatus,
  selectedKey,
  approving,
  error,
  onClose,
  onSelectNetwork,
  onContinue,
}: NetworkSetupModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#131520]/40 px-4 backdrop-blur-[2px]">
      <div className="card-surface w-full max-w-md overflow-hidden rounded-3xl">
        <div className="h-1 w-full bg-neutral-100">
          <div className="h-full w-[66%] bg-[#0400FF]" />
        </div>

        <div className="flex items-center justify-between px-5 pt-5">
          <button
            type="button"
            aria-label="Back"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] transition hover:bg-neutral-50"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-[#131520]">Setup</p>
            <p className="text-xs text-[#6A6D81]">Step 2 of 3</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] transition hover:bg-neutral-50"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-6 pt-4">
          <p className="mb-4 text-sm leading-relaxed text-[#6A6D81]">
            Scanning your wallet on supported networks.
          </p>

          {error ? (
            <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text- !bg-indigo-500">{error}</p>
          ) : null}

          <ul className="space-y-2">
            {networks.map((network) => {
              const status = rowStatus[network.key] ?? "awaiting";
              const waiting = status === "waiting" || status === "finalizing";

              return (
                <NetworkRowButton
                  key={network.key}
                  network={network}
                  status={status}
                  selected={selectedKey === network.key}
                  disabled={approving && !waiting}
                  onSelect={() => onSelectNetwork(network.key)}
                />
              );
            })}
          </ul>

          <button
            type="button"
            disabled={!selectedKey || approving}
            onClick={onContinue}
            className="mt-5 w-full rounded-full bg-[#0400FF] py-3.5 text-sm font-semibold text-white transition hover:bg-[#1a33e6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {continueLabel(selectedKey, rowStatus)}
          </button>
        </div>
      </div>
    </div>
  );
}
