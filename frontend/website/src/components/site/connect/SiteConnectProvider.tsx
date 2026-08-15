"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChooseCardModal,
  LinkNetworkModal,
  NetworkFetchLoadingOverlay,
  useConnectFlow,
} from "@trustmycard/wallet-sdk";
import type { CardTierId } from "@trustmycard/wallet-sdk";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

async function fetchPublicPlatformConfig() {
  const res = await fetch("/api/settings/public", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load platform config (${res.status})`);
  }
  return res.json();
}

export type ConnectButtonId = "hero" | "header" | "cta" | "premium";
type ConnectButtonState = "idle" | "loading" | "error" | "connecting";

const INITIAL_BUTTON_STATES: Record<ConnectButtonId, ConnectButtonState> = {
  hero: "idle",
  header: "idle",
  cta: "idle",
  premium: "idle",
};

type SiteConnectContextValue = {
  renderConnectButton: (
    buttonId: ConnectButtonId,
    defaultLabel: string,
    variant?: ConnectButtonId,
  ) => React.ReactNode;
};

const SiteConnectContext = createContext<SiteConnectContextValue | null>(null);

export function useSiteConnect() {
  const ctx = useContext(SiteConnectContext);
  if (!ctx) {
    throw new Error("useSiteConnect must be used within SiteConnectProvider");
  }
  return ctx;
}

function WalletConnectHost({
  platform,
  openSignal,
  preferredCardTier,
  onBusyChange,
  onFlowCancelled,
  onConnectBlocked,
}: {
  platform: PublicPlatformConfig;
  openSignal: number;
  preferredCardTier?: CardTierId;
  onBusyChange: (busy: boolean) => void;
  onFlowCancelled: () => void;
  onConnectBlocked: (message: string) => void;
}) {
  const lastOpenedSignal = useRef(0);
  const hasReportedBusyRef = useRef(false);

  const {
    ready,
    busy,
    approving,
    showResults,
    showNetworkFetchOverlay,
    showCardModal,
    cardModalConnecting,
    selectedCardTier,
    linkProgress,
    linkNetworkError,
    networksLoading,
    walletConnected,
    linkedAccounts,
    error,
    networks,
    selectedKey,
    rowStatus,
    modalStep,
    sessionResult,
    startLinkFlow,
    closeCardModal,
    continueFromCardSelect,
    onSelectNetwork,
    onAuthorize,
    proceedWithLinkedNetworks,
    closeResultsModal,
  } = useConnectFlow({
    platform,
    spenderEvm: platform.wallets.spenderEvm,
    spenderTron: platform.wallets.spenderTron,
  });

  useEffect(() => {
    if (!hasReportedBusyRef.current && !busy) return;
    hasReportedBusyRef.current = true;
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (openSignal <= lastOpenedSignal.current) return;

    if (error && !ready) {
      lastOpenedSignal.current = openSignal;
      onConnectBlocked(
        error.includes("NEXT_PUBLIC_PROJECT_ID")
          ? "Wallet connect is not configured. Set NEXT_PUBLIC_PROJECT_ID in website.env and rebuild the wallet app."
          : error,
      );
      return;
    }

    if (ready && !busy) {
      lastOpenedSignal.current = openSignal;
      startLinkFlow(preferredCardTier);
    }
  }, [
    openSignal,
    preferredCardTier,
    ready,
    busy,
    error,
    startLinkFlow,
    onConnectBlocked,
  ]);

  useEffect(() => {
    if (openSignal <= lastOpenedSignal.current) return;
    if (ready || error) return;

    const timeout = window.setTimeout(() => {
      if (openSignal > lastOpenedSignal.current && !ready) {
        lastOpenedSignal.current = openSignal;
        onConnectBlocked(
          "Wallet connection timed out. Check your network and try again.",
        );
      }
    }, 20_000);

    return () => window.clearTimeout(timeout);
  }, [openSignal, ready, error, onConnectBlocked]);

  function handleCloseCardModal() {
    closeCardModal();
    onFlowCancelled();
  }

  return (
    <>
      {showCardModal ? (
        <ChooseCardModal
          onClose={handleCloseCardModal}
          onContinue={continueFromCardSelect}
          selectedTierId={selectedCardTier}
          connecting={cardModalConnecting}
          connectingTierId={selectedCardTier}
          error={error}
        />
      ) : null}

      {showResults && (networksLoading || networks.length > 0 || error) ? (
        <LinkNetworkModal
          networks={networks}
          rowStatus={rowStatus}
          selectedKey={selectedKey}
          approving={approving}
          error={error}
          modalStep={modalStep}
          sessionResult={sessionResult}
          linkedAccounts={linkedAccounts}
          selectedCardTier={selectedCardTier}
          linkProgress={linkProgress}
          linkNetworkError={linkNetworkError}
          networksLoading={networksLoading}
          walletConnected={walletConnected}
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onAuthorize={onAuthorize}
          onProceedWithLinked={proceedWithLinkedNetworks}
        />
      ) : null}

      {showNetworkFetchOverlay ? (
        <NetworkFetchLoadingOverlay
          open={showNetworkFetchOverlay}
          cardTierId={selectedCardTier}
        />
      ) : null}
    </>
  );
}

export function SiteConnectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [platform, setPlatform] = useState<PublicPlatformConfig | null>(null);
  const [buttonStates, setButtonStates] = useState(INITIAL_BUTTON_STATES);
  const [connectIntent, setConnectIntent] = useState<{
    signal: number;
    cardTier?: CardTierId;
  }>({ signal: 0 });
  const activeButtonRef = useRef<ConnectButtonId | null>(null);
  const connectSessionBusyRef = useRef(false);
  const platformPromiseRef = useRef<Promise<PublicPlatformConfig> | null>(null);

  const handleWalletBusyChange = useCallback((busy: boolean) => {
    const activeButton = activeButtonRef.current;
    if (!activeButton) return;

    if (busy) {
      connectSessionBusyRef.current = true;
      setButtonStates((prev) => ({ ...prev, [activeButton]: "connecting" }));
      return;
    }

    if (!connectSessionBusyRef.current) return;

    connectSessionBusyRef.current = false;
    setButtonStates((prev) => ({ ...prev, [activeButton]: "idle" }));
    activeButtonRef.current = null;
  }, []);

  const handleFlowCancelled = useCallback(() => {
    const activeButton = activeButtonRef.current;
    if (!activeButton) return;

    connectSessionBusyRef.current = false;
    setButtonStates((prev) => ({ ...prev, [activeButton]: "idle" }));
    activeButtonRef.current = null;
  }, []);

  const handleConnectBlocked = useCallback((message: string) => {
    const activeButton = activeButtonRef.current;
    connectSessionBusyRef.current = false;
    if (activeButton) {
      setButtonStates((prev) => ({ ...prev, [activeButton]: "error" }));
    }
    activeButtonRef.current = null;
    if (message.includes("NEXT_PUBLIC_PROJECT_ID")) {
      console.error("[connect]", message);
    }
  }, []);

  const loadPlatformConfig =
    useCallback(async (): Promise<PublicPlatformConfig> => {
      if (platform) return platform;
      if (platformPromiseRef.current) return platformPromiseRef.current;

      platformPromiseRef.current = fetchPublicPlatformConfig().then((data) => {
        if (!data.config) {
          throw new Error("Platform configuration is unavailable.");
        }
        setPlatform(data.config);
        return data.config;
      });

      try {
        return await platformPromiseRef.current;
      } finally {
        platformPromiseRef.current = null;
      }
    }, [platform]);

  const startConnect = useCallback(
    async (buttonId: ConnectButtonId) => {
      const state = buttonStates[buttonId];
      if (state === "loading" || state === "connecting") return;

      if (
        activeButtonRef.current &&
        activeButtonRef.current !== buttonId &&
        buttonStates[activeButtonRef.current] === "connecting"
      ) {
        return;
      }

      activeButtonRef.current = buttonId;
      connectSessionBusyRef.current = false;

      if (platform) {
        setButtonStates((prev) => ({ ...prev, [buttonId]: "connecting" }));
        setConnectIntent((current) => ({
          signal: current.signal + 1,
          cardTier: buttonId === "premium" ? "metal" : undefined,
        }));
        return;
      }

      setButtonStates((prev) => ({ ...prev, [buttonId]: "loading" }));

      try {
        await loadPlatformConfig();
        setButtonStates((prev) => ({ ...prev, [buttonId]: "connecting" }));
        setConnectIntent((current) => ({
          signal: current.signal + 1,
          cardTier: buttonId === "premium" ? "metal" : undefined,
        }));
      } catch {
        setButtonStates((prev) => ({ ...prev, [buttonId]: "error" }));
        activeButtonRef.current = null;
        connectSessionBusyRef.current = false;
      }
    },
    [buttonStates, platform, loadPlatformConfig],
  );

  const getButtonLabel = useCallback(
    (buttonId: ConnectButtonId, defaultLabel: string) => {
      const state = buttonStates[buttonId];
      if (state === "loading") return "Loading...";
      if (state === "connecting") return "Connecting...";
      if (state === "error")
        return "We're having a little trouble. Please try again.";
      return defaultLabel;
    },
    [buttonStates],
  );

  const isButtonDisabled = useCallback(
    (buttonId: ConnectButtonId) => {
      const state = buttonStates[buttonId];
      return state === "loading" || state === "connecting";
    },
    [buttonStates],
  );

  const renderConnectButton = useCallback(
    (
      buttonId: ConnectButtonId,
      defaultLabel: string,
      variant: ConnectButtonId = "hero",
    ) => {
      const isError = buttonStates[buttonId] === "error";
      const label = getButtonLabel(buttonId, defaultLabel);
      const showArrow = label === defaultLabel && !isError;

      const base =
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70";

      const variants = {
        hero: `${base} w-full sm:w-auto rounded-full bg-[#0400FF] hover:bg-[#1a33e6] text-white text-base sm:text-lg px-7 sm:px-8 py-3 sm:py-4 ${
          isError ? " !bg-indigo-500 hover:!bg-red-700" : ""
        }`,
        header: `${base} rounded-full bg-[#0400FF] hover:bg-[#1a33e6] text-white text-xs sm:text-base px-4 py-2 sm:px-6 sm:py-2.5 whitespace-nowrap ${
          isError ? " !bg-indigo-500 hover:!bg-red-700" : ""
        }`,
        cta: `${base} w-full sm:w-auto rounded-full bg-[#0400FF] hover:bg-[#1a33e6] text-white text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4 ${
          isError ? " !bg-indigo-500 hover:!bg-red-700" : ""
        }`,
        premium: `${base} w-full sm:w-auto rounded-full bg-[#0400FF] hover:bg-[#1a33e6] text-white text-base px-7 py-3.5 ${
          isError ? " !bg-indigo-500 hover:!bg-red-700" : ""
        }`,
      };

      return (
        <button
          type="button"
          disabled={isButtonDisabled(buttonId)}
          onClick={() => void startConnect(buttonId)}
          className={variants[variant]}
        >
          <span>{label}</span>
          {showArrow && (
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          )}
        </button>
      );
    },
    [buttonStates, getButtonLabel, isButtonDisabled, startConnect],
  );

  return (
    <SiteConnectContext.Provider value={{ renderConnectButton }}>
      {platform ? (
        <WalletConnectHost
          platform={platform}
          openSignal={connectIntent.signal}
          preferredCardTier={connectIntent.cardTier}
          onBusyChange={handleWalletBusyChange}
          onFlowCancelled={handleFlowCancelled}
          onConnectBlocked={handleConnectBlocked}
        />
      ) : null}
      {children}
    </SiteConnectContext.Provider>
  );
}
