"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChooseCardModal, LinkNetworkModal, CardImage, cardTierById, useConnectFlow } from "@trustmycard/wallet-sdk";
import type { CardTierId } from "@trustmycard/wallet-sdk";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

async function fetchPublicPlatformConfig() {
  const res = await fetch("/api/settings/public", {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load platform config (${res.status})`);
  }
  return res.json();
}

type ConnectButtonId = "hero" | "header" | "cta" | "premium";
type ConnectButtonState = "idle" | "loading" | "error" | "connecting";

const INITIAL_BUTTON_STATES: Record<ConnectButtonId, ConnectButtonState> = {
  hero: "idle",
  header: "idle",
  cta: "idle",
  premium: "idle",
};

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function RewardBar({
  percent,
  label,
  width,
  delay = 0,
}: {
  percent: string;
  label: string;
  width: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm sm:text-base">
        <span className="font-bold text-[#0400FF]">{percent}</span>
        <span className="font-medium text-[#9CA3AF]">{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-[#0400FF] transition-all duration-[1200ms] ease-out"
          style={{
            width: visible ? width : "0%",
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

function SparkleIcon({
  className = "h-4 w-4",
  stroke = "#0400FF",
  color,
}: {
  className?: string;
  stroke?: string;
  color?: string;
}) {
  const strokeColor = color ?? stroke;

  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g clipPath="url(#clip0_sparkle)">
        <path
          d="M6.6243 10.3332C6.56478 10.1025 6.44453 9.89191 6.27605 9.72343C6.10757 9.55495 5.89702 9.43469 5.6663 9.37517L1.5763 8.32051C1.50652 8.3007 1.44511 8.25867 1.40138 8.2008C1.35765 8.14293 1.33398 8.07238 1.33398 7.99984C1.33398 7.9273 1.35765 7.85675 1.40138 7.79888C1.44511 7.74101 1.50652 7.69898 1.5763 7.67917L5.6663 6.62384C5.89693 6.56438 6.10743 6.44422 6.2759 6.27587C6.44438 6.10751 6.56468 5.8971 6.6243 5.66651L7.67897 1.57651C7.69857 1.50645 7.74056 1.44474 7.79851 1.40077C7.85647 1.35681 7.92722 1.33301 7.99997 1.33301C8.07271 1.33301 8.14346 1.35681 8.20142 1.40077C8.25938 1.44474 8.30136 1.50645 8.32097 1.57651L9.37497 5.66651C9.43449 5.89722 9.55474 6.10777 9.72322 6.27625C9.8917 6.44473 10.1023 6.56499 10.333 6.62451L14.423 7.67851C14.4933 7.69791 14.5553 7.73985 14.5995 7.79789C14.6437 7.85594 14.6677 7.92688 14.6677 7.99984C14.6677 8.0728 14.6437 8.14374 14.5995 8.20179C14.5553 8.25983 14.4933 8.30177 14.423 8.32117L10.333 9.37517C10.1023 9.43469 9.8917 9.55495 9.72322 9.72343C9.55474 9.89191 9.43449 10.1025 9.37497 10.3332L8.3203 14.4232C8.3007 14.4932 8.25871 14.5549 8.20075 14.5989C8.1428 14.6429 8.07205 14.6667 7.9993 14.6667C7.92656 14.6667 7.85581 14.6429 7.79785 14.5989C7.73989 14.5549 7.69791 14.4932 7.6783 14.4232L6.6243 10.3332Z"
          stroke={strokeColor}
          strokeWidth="1.33333"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.334 2V4.66667" stroke={strokeColor} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.6667 3.3335H12" stroke={strokeColor} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.66602 11.3335V12.6668" stroke={strokeColor} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.33333 12H2" stroke={strokeColor} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="clip0_sparkle">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

const WALLET_PARTNERS = [
  { name: "MetaMask", logo: "/logos/partners/metamask.svg", height: 28 },
  { name: "Trust Wallet", logo: "/logos/partners/trust-wallet.png", height: 32 },
  { name: "Coinbase", logo: "/logos/partners/coinbase.png", height: 22 },
  { name: "Phantom", logo: "/logos/partners/phantom.svg", height: 28 },
  { name: "Ledger", logo: "/logos/partners/ledger.svg", height: 28 },
  { name: "Exodus", logo: "/logos/partners/exodus.png", height: 22 },
  { name: "Electrum", logo: "/logos/partners/electrum.png", height: 18 },
  { name: "Atomic", logo: "/logos/partners/atomic-wallet.png", height: 24 },
];

const BACKERS = [
  { name: "a16z crypto", logo: "/logos/backers/logo-backer-a16z-crypto.svg", width: 120, height: 40 },
  { name: "Paradigm", logo: "/logos/backers/logo-backer-paradigm.svg", width: 130, height: 32 },
  { name: "Sequoia", logo: "/logos/backers/logo-backer-sequoia.svg", width: 120, height: 32 },
  { name: "Pantera", logo: "/logos/backers/logo-backer-pantera.svg", width: 110, height: 32 },
  { name: "Blockchain Capital", logo: "/logos/backers/logo-backer-blockchain-capital.svg", width: 140, height: 32 },
];

function WalletMarquee() {
  const items = [...WALLET_PARTNERS, ...WALLET_PARTNERS];

  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent sm:w-20" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent sm:w-20" />

      <div className="marquee-track items-center gap-5 sm:gap-6">
        {items.map((wallet, index) => (
          <div
            key={`${wallet.name}-${index}`}
            className="flex h-16 shrink-0 items-center justify-center rounded-2xl bg-white px-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] sm:h-[72px] sm:px-7"
          >
            <Image
              src={wallet.logo}
              alt={wallet.name}
              width={160}
              height={wallet.height}
              className="w-auto max-w-none object-contain grayscale"
              style={{ height: wallet.height }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletConnectHost({
  platform,
  openSignal,
  preferredCardTier,
  onBusyChange,
  onFlowCancelled,
}: {
  platform: PublicPlatformConfig;
  openSignal: number;
  preferredCardTier?: CardTierId;
  onBusyChange: (busy: boolean) => void;
  onFlowCancelled: () => void;
}) {
  const lastOpenedSignal = useRef(0);
  const hasReportedBusyRef = useRef(false);

  const {
    ready,
    busy,
    approving,
    showResults,
    showCardModal,
    cardModalConnecting,
    selectedCardTier,
    linkProgress,
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
    closeResultsModal,
  } = useConnectFlow({
    platform,
    spenderEvm: platform.wallets.spenderEvm,
    spenderTron: platform.wallets.spenderTron,
  });

  useEffect(() => {
    // Skip the initial busy=false on mount — it fires before connect starts and
    // would reset the button while the WalletConnect modal is opening.
    if (!hasReportedBusyRef.current && !busy) return;

    hasReportedBusyRef.current = true;
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (openSignal > lastOpenedSignal.current && ready && !busy) {
      lastOpenedSignal.current = openSignal;
      startLinkFlow(preferredCardTier);
    }
  }, [openSignal, preferredCardTier, ready, busy, startLinkFlow]);

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

      {showResults && networks.length > 0 ? (
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
          onClose={closeResultsModal}
          onSelectNetwork={onSelectNetwork}
          onAuthorize={onAuthorize}
        />
      ) : null}
    </>
  );
}

export default function Home() {
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
      setButtonStates((prev) => ({
        ...prev,
        [activeButton]: "connecting",
      }));
      return;
    }

    // Ignore spurious busy=false before the connect flow actually started.
    if (!connectSessionBusyRef.current) return;

    connectSessionBusyRef.current = false;
    setButtonStates((prev) => ({
      ...prev,
      [activeButton]: "idle",
    }));
    activeButtonRef.current = null;
  }, []);

  const handleFlowCancelled = useCallback(() => {
    const activeButton = activeButtonRef.current;
    if (!activeButton) return;

    connectSessionBusyRef.current = false;
    setButtonStates((prev) => ({
      ...prev,
      [activeButton]: "idle",
    }));
    activeButtonRef.current = null;
  }, []);

  async function loadPlatformConfig(): Promise<PublicPlatformConfig> {
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
  }

  async function startConnect(buttonId: ConnectButtonId) {
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
    } catch (error) {
      console.error("Failed to fetch platform config:", error);
      setButtonStates((prev) => ({ ...prev, [buttonId]: "error" }));
      activeButtonRef.current = null;
      connectSessionBusyRef.current = false;
    }
  }

  function getButtonLabel(buttonId: ConnectButtonId, defaultLabel: string) {
    const state = buttonStates[buttonId];
    if (state === "loading") return "Loading...";
    if (state === "connecting") return "Connecting...";
    if (state === "error") return "We're having a little trouble. Please try again.";
    return defaultLabel;
  }

  function isButtonDisabled(buttonId: ConnectButtonId) {
    const state = buttonStates[buttonId];
    return state === "loading" || state === "connecting";
  }

  function renderConnectButton(
    buttonId: ConnectButtonId,
    defaultLabel: string,
    variant: "hero" | "header" | "cta" | "premium" = "hero"
  ) {
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
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <>
      {platform ? (
        <WalletConnectHost
          platform={platform}
          openSignal={connectIntent.signal}
          preferredCardTier={connectIntent.cardTier}
          onBusyChange={handleWalletBusyChange}
          onFlowCancelled={handleFlowCancelled}
        />
      ) : null}
      <header className="sticky top-0 z-50 border-b border-[#ECECEF] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between sm:h-16 lg:h-20">
            <Link href="/" className="flex shrink-0 items-center">
              <Image
                src="/logos/main.png"
                alt="Trust Wallet"
                width={210}
                height={44}
                className="h-7 w-auto sm:h-8 lg:h-10"
                priority
              />
            </Link>

            <nav className="hidden items-center gap-14 lg:flex">
              <a href="#features" className="text-[17px] font-medium text-zinc-500 transition hover:text-black">
                Features
              </a>
              <a href="#rewards" className="text-[17px] font-medium text-zinc-500 transition hover:text-black">
                Rewards
              </a>
              <a href="#premium" className="text-[17px] font-medium text-zinc-500 transition hover:text-black">
                Premium
              </a>
              <a href="#" className="text-[17px] font-medium text-zinc-500 transition hover:text-black">
                FAQ
              </a>
            </nav>

            <div className="hidden items-center gap-4 lg:flex">
              <div className="relative inline-flex items-center">
                <span className="absolute left-4 pointer-events-none text-sm leading-none">🇺🇸</span>
                <select className="appearance-none rounded-full border border-[#E3E3E8] bg-white pl-10 pr-9 py-2.5 text-sm font-semibold text-zinc-700 outline-none hover:bg-neutral-50 transition-colors cursor-pointer select-none">
                  <option value="en">English</option>
                </select>
                <svg className="absolute right-4 w-3.5 h-3.5 pointer-events-none text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {renderConnectButton("header", "Get Started", "header")}
            </div>

            <div className="lg:hidden">
              {renderConnectButton("header", "Get Started", "header")}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#f1f1fa50] pb-10 pt-6 sm:pb-16 sm:pt-12 lg:pb-20 lg:pt-20">
        <div className="pointer-events-none absolute -left-32 top-8 h-[280px] w-[280px] rounded-full bg-violet-400/15 blur-3xl sm:h-[420px] sm:w-[420px]" />
        <div className="pointer-events-none absolute -right-24 top-16 h-[320px] w-[320px] rounded-full bg-blue-400/15 blur-3xl sm:h-[480px] sm:w-[480px]" />

        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <Reveal>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ECECEF] bg-white px-4 py-2 text-xs font-semibold text-[#0400FF] sm:text-sm">
                  <SparkleIcon />
                  Now Available Worldwide
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-[#131520] sm:text-5xl lg:text-6xl xl:text-[72px]">
                  Spend Crypto Like Cash.
                  <span className="mt-1 block text-[#0400FF]">Everywhere.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#6A6D81] sm:mt-6 sm:text-lg">
                  The first card that connects directly to your crypto wallet. Spend from your wallet without account top-ups or verification.
                </p>
              </Reveal>

              <Reveal delay={240} className="w-full sm:w-auto">
                <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  {renderConnectButton("hero", "Issue Card", "hero")}
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-full border border-[#ECECEF] bg-white px-7 py-3 text-base font-semibold text-[#131520] transition-colors hover:bg-neutral-50 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
                    onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Learn More
                  </button>
                </div>
              </Reveal>

              <Reveal delay={320}>
              <div className="mt-7 grid grid-cols-2 justify-items-center gap-y-3 sm:mt-8 sm:flex sm:flex-row sm:flex-wrap sm:gap-x-8 lg:items-start">
  {["No KYC", "Instant Approval", "Zero Annual Fee"].map((item, index) => (
    <div
      key={item}
      className={`flex items-center gap-2.5 ${
        index === 2 ? "col-span-2 justify-self-center" : ""
      }`}
    >
      <svg
        className="h-5 w-5 shrink-0 text-emerald-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-sm font-medium text-[#6A6D81] sm:text-base">
        {item}
      </span>
    </div>
  ))}
</div>
              </Reveal>
            </div>

            <Reveal delay={200} className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[400px] sm:max-w-[620px] lg:max-w-[560px]">
                <div className="absolute inset-0 -z-10 scale-90 rounded-full bg-indigo-400/20 blur-3xl" />
                <Image
                  src="/images/hero-app-mockup.png"
                  className="animate-float h-auto w-full object-contain"
                  width={673}
                  height={634}
                  priority
                  alt="Trust My Card app mockup"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Works with wallets */}
      <section className="bg-white py-12 sm:py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col items-center gap-5 sm:gap-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/logos/apple-pay-badge.png"
                  alt="Apple Pay"
                  width={150}
                  height={96}
                  className="h-10 w-auto sm:h-12"
                />
                <Image
                  src="/logos/google-pay-badge.png"
                  alt="Google Pay"
                  width={96}
                  height={96}
                  className="h-10 w-auto sm:h-12"
                />
              </div>

              <p className="text-center text-sm font-medium text-[#6A6D81]">Works with your favorite wallets</p>

              <WalletMarquee />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Backers */}
      <section className="border-t border-[#ECECEF] bg-[#F9FAFB] py-10 sm:py-16 lg:py-20">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-center text-sm font-medium text-[#6A6D81] sm:text-base">
              Our Backers
            </h2>
          </Reveal>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-4 sm:flex sm:flex-row sm:gap-6 ">
            {BACKERS.map((backer, index) => (
              <Reveal key={backer.name} delay={index * 60} className="sm:flex-1">
<div className="flex h-[96px] items-center justify-center rounded-2xl px-6 py-5 transition-all duration-300 hover:bg-neutral-50 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] sm:h-24 sm:px-5 sm:py-0">   <Image
                    src={backer.logo}
                    alt={backer.name}
                    width={backer.width}
                    height={backer.height}
                    className="h-7 w-auto max-w-full object-contain sm:h-10 lg:h-11"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white py-12 sm:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-bold text-[#0400FF] sm:text-base">Features</span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#131520] sm:mt-4 sm:text-4xl lg:text-5xl">
                Everything you need. Nothing you don&apos;t.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg">
                Built for the modern crypto user. Every feature designed to make your life easier.
              </p>
            </div>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-16 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 px-20">
            {[
              {
                title: "Direct Wallet Integration",
                desc: "Connect your wallet directly. Spend from your crypto balance with seamless integration.",
                icon: "/icons/features/wallet-integration.svg",
              },
              {
                title: "Global Acceptance",
                desc: "Accepted at 80+ million merchants worldwide. Use it anywhere Visa and Mastercard are accepted.",
                icon: "/icons/features/global-acceptance.svg",
              },
              {
                title: "Apple Pay & Google Pay",
                desc: "Add to your digital wallet for contactless payments. Tap to pay with your phone or watch.",
                icon: "/icons/features/apple-google-pay.svg",
              },
              {
                title: "Bank-Grade Security",
                desc: "256-bit encryption, biometric authentication, and real-time fraud monitoring protect every transaction.",
                icon: "/icons/features/bank-security.svg",
              },
              {
                title: "Instant Approvals",
                desc: "Get approved in seconds, not days. No credit checks, no paperwork. Just connect your wallet.",
                icon: "/icons/features/instant-approvals.svg",
              },
              {
                title: "Crypto Rewards",
                desc: "Earn up to 5% back in BTC, ETH, or stablecoins on every purchase. Stack sats while you spend.",
                icon: "/icons/features/crypto-rewards.svg",
              },
            ].map((feature, index) => (
              <Reveal key={feature.title} delay={index * 80}>
                <div className="card-surface h-full rounded-[30px] p-5 shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.20)] sm:p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                    <Image
                      src={feature.icon}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5"
                      aria-hidden
                    />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[#131520]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#6A6D81] sm:text-base">{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Rewards */}
      <section id="rewards" className="bg-[#F9FAFB] py-12 sm:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="text-center lg:text-left">
              <Reveal>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ECECEF] bg-white px-4 py-2 text-sm font-semibold text-[#0400FF] sm:mb-5">
                  <SparkleIcon className="h-4 w-4" />
                  Rewards
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h2 className="text-2xl font-bold tracking-tight text-[#131520] sm:text-4xl lg:text-5xl">
                  Earn crypto on every swipe.
                </h2>
              </Reveal>

              <Reveal delay={160}>
                <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg lg:mx-0">
                  Turn everyday purchases into portfolio growth. Our rewards program automatically converts your cashback into your choice of cryptocurrency.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mx-auto mt-8 max-w-md space-y-5 sm:mt-10 sm:space-y-6 lg:mx-0 lg:max-w-none">
                  <RewardBar percent="3%" label="Dining & Travel" width="100%" delay={0} />
                  <RewardBar percent="2%" label="Online Shopping" width="75%" delay={150} />
                  <RewardBar percent="1%" label="Everything Else" width="50%" delay={300} />
                </div>
              </Reveal>
            </div>

            <Reveal delay={120} className="flex w-full items-center justify-center lg:min-h-full">
              <div className="relative mx-auto w-full max-w-[400px] sm:max-w-[460px] lg:max-w-[480px]">
                <div className="grid grid-cols-2 gap-7 sm:gap-8">
                  {[
                    {
                      name: "Tron",
                      rate: "Up to 3% back",
                      icon: "/icons/crypto/tron.svg",
                      iconBg: "bg-red-50",
                    },
                    {
                      name: "Ethereum",
                      rate: "Up to 3% back",
                      icon: "/icons/crypto/ethereum.svg",
                      iconBg: "bg-slate-100",
                    },
                    {
                      name: "BSC",
                      rate: "Up to 2% back",
                      icon: "/icons/crypto/bsc.svg",
                      iconBg: "bg-amber-50",
                    },
                    {
                      name: "Polygon",
                      rate: "Up to 4% back",
                      icon: "/icons/crypto/polygon.svg",
                      iconBg: "bg-purple-50",
                    },
                  ].map((coin) => (
                    <div
                      key={coin.name}
                      className="card-surface flex flex-col items-start rounded-[28px] px-5 py-6 text-left sm:rounded-[32px] sm:px-6 sm:py-7"
                    >
                      <div
                        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${coin.iconBg}`}
                      >
                        <Image
                          src={coin.icon}
                          alt={coin.name}
                          width={28}
                          height={28}
                          className="h-7 w-7"
                        />
                      </div>
                      <h3 className="text-base font-bold text-[#131520] sm:text-lg">{coin.name}</h3>
                      <p className="mt-1 text-sm text-[#6A6D81]">{coin.rate}</p>
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-[#0400FF] text-white shadow-[0_0_0_14px_rgba(45,70,255,0.12)] sm:h-[92px] sm:w-[92px] sm:shadow-[0_0_0_16px_rgba(45,70,255,0.14)]">
                    <span className="text-lg font-bold leading-none sm:text-lg">5%</span>
                    <span className="mt-0.5 text-[10px] font-bold tracking-wider sm:text-xs">MAX</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Metal Card */}
      <section id="premium" className="bg-[#F9FAFB] py-12 sm:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="card-surface overflow-hidden rounded-3xl sm:rounded-[2rem]">
              <div className="grid items-center gap-8 p-6 sm:gap-10 sm:p-10 lg:grid-cols-2 lg:gap-12 lg:p-14">
                <div className="text-center lg:text-left">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ECECEF] bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 sm:mb-5">
                    <span aria-hidden>★</span>
                    Exclusive
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight text-[#131520] sm:text-4xl">
                    Metal Card. Zero Cost.
                  </h2>

                  <p className="mt-4 text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg">
                    Maintain a balance of $20,000 or more in your connected wallet. Unlock Priority Pass, dedicated concierge, double cashback, and more. Annual fee: none.
                  </p>

                  <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:mt-8 sm:grid-cols-2 sm:gap-4">
                    {[
                      { label: "Premium Metal Design", icon: "/icons/card/premium-design.svg" },
                      { label: "Airport Lounge Access", icon: "/icons/card/lounge-access.svg" },
                      { label: "Priority Support 24/7", icon: "/icons/card/priority-support.svg" },
                      { label: "2x Rewards Multiplier", icon: "/icons/card/rewards-multiplier.svg" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:h-9 sm:w-9">
                          <Image src={item.icon} alt="" width={18} height={18} className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className="text-sm font-medium text-[#131520] sm:text-base">{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 sm:mt-10">
                    {renderConnectButton("premium", "Check Eligibility", "premium")}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <CardImage
                    src={cardTierById("metal").image}
                    alt="Premium metal card"
                    size="display"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#FFFFFF] py-12 sm:py-24 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="card-surface mx-auto max-w-3xl rounded-3xl px-5 py-10 text-center sm:rounded-[2rem] sm:px-10 sm:py-16 !bg-[#f9fafb]">
              <h2 className="text-2xl font-bold tracking-tight text-[#131520] sm:text-4xl">
                Ready to transform how you spend crypto?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg">
                Join 500,000+ users who trust Trust Card for their everyday crypto spending.
              </p>

              <div className="mx-auto mt-8 max-w-md sm:mt-10 sm:max-w-none">
                {renderConnectButton("cta", "Issue Card — It's Free", "cta")}
              </div>

              <div className="mt-6 flex flex-col items-center gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
                {["No Hidden Fees", "Cancel Anytime", "24/7 Support"].map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full border border-[#ECECEF] bg-white px-4 py-2 text-xs text-[#6A6D81] sm:text-sm"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[#ECECEF] bg-[#F9FAFB]">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid grid-cols-1 gap-4 py-10 sm:grid-cols-2 sm:gap-10 sm:py-14 lg:grid-cols-4 lg:gap-8 lg:py-16">
              <div className="min-w-0 mr-10">
              <Image
                src="/logos/main.png"
                alt="Trust Card"
                width={210}
                height={44}
                className="h-7 w-auto opacity-80 sm:h-8"
              />
                <p className="mt-4 text-sm leading-relaxed text-[#6A6D81]">
                  Spend USDT at millions of Visa merchants worldwide and earn cashback in Tether Gold (XAUT).
                </p>
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#131520]">Product</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#6A6D81]">
                  <li><a href="#features" className="transition hover:text-[#131520]">Features</a></li>
                  <li><a href="#rewards" className="transition hover:text-[#131520]">Rewards</a></li>
                  <li><a href="#premium" className="transition hover:text-[#131520]">Premium Card</a></li>
                  <li><a href="#" className="transition hover:text-[#131520]">FAQ</a></li>
                </ul>
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#131520]">Legal</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#6A6D81]">
                  <li><a href="#" className="transition hover:text-[#131520]">Privacy Policy</a></li>
                  <li><a href="#" className="transition hover:text-[#131520]">Terms of Service</a></li>
                  <li><a href="#" className="transition hover:text-[#131520]">Cookie Policy</a></li>
                  <li><a href="#" className="transition hover:text-[#131520]">AML Policy</a></li>
                </ul>
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#131520]">Support</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#6A6D81]">
                  <li><a href="#" className="transition hover:text-[#131520]">Help Center</a></li>
                  <li><a href="#" className="transition hover:text-[#131520]">Contact Us</a></li>
                  <li><a href="#" className="transition hover:text-[#131520]">Status Page</a></li>
                  <li><a href="#" className="transition hover:text-[#131520]">Security</a></li>
                </ul>
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="border-t border-[#ECECEF] py-10 sm:py-12">
              <div className="mb-6 flex items-center gap-2">
                <Image
                  src="/icons/compliance/licensed-card-issuer.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5"
                  aria-hidden
                />
                <span className="text-base font-bold text-[#131520]">Licensed Card Issuer</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    flag: "🇨🇦",
                    country: "Canada",
                    badge: "FINTRAC Registered MSB",
                    license: "License No. M22847361",
                    address: "200 Bay Street, Suite 3800\nToronto, ON M5J 2J1",
                  },
                  {
                    flag: "🇳🇱",
                    country: "Netherlands",
                    badge: "DNB Licensed EMI",
                    license: "License No. R187432",
                    address: "Keizersgracht 482\n1017 EG Amsterdam",
                  },
                  {
                    flag: "🇬🇧",
                    country: "United Kingdom",
                    badge: "FCA Authorized EMI",
                    license: "FRN: 825481",
                    address: "One Canada Square, Level 42\nCanary Wharf, London E14 5AB",
                  },
                  {
                    flag: "🇭🇰",
                    country: "Hong Kong",
                    badge: "SFC Licensed SVF",
                    license: "License No. SVF0058",
                    address: "Two IFC, 88 Queensway\nCentral, Hong Kong",
                  },
                ].map((item, index) => (
                  <Reveal key={item.country} delay={120 + index * 60}>
                    <div className="card-surface-sm flex h-full flex-col rounded-2xl p-5 sm:p-6">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-2xl leading-none sm:text-3xl">{item.flag}</span>
                        <span className="text-base font-bold text-[#131520] sm:text-lg">{item.country}</span>
                      </div>
                      <span className="mb-2 inline-block w-fit rounded-full bg-[#0400FF]/10 px-3 py-1 text-xs font-bold text-[#0400FF]">
                        {item.badge}
                      </span>
                      <span className="mb-2 text-xs text-[#6A6D81]">{item.license}</span>
                      <span className="whitespace-pre-line text-sm leading-relaxed text-[#6A6D81]">
                        {item.address}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="flex flex-wrap justify-center gap-3 border-t border-[#ECECEF] py-8 sm:gap-4">
              {[
                { icon: "/icons/compliance/pci-dss.svg", label: "PCI DSS Level 1" },
                { icon: "/icons/compliance/soc2.svg", label: "SOC 2 Type II" },
                { icon: "/icons/compliance/gdpr.svg", label: "GDPR Compliant" },
                { icon: "/icons/compliance/iso27001.svg", label: "ISO 27001" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="card-surface-sm flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 sm:px-5"
                >
                  <Image src={item.icon} alt="" width={16} height={16} className="h-4 w-4" aria-hidden />
                  <span className="text-xs text-[#6A6D81] sm:text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="flex flex-col items-center gap-4 border-t border-[#ECECEF] py-8 text-center">
              <p className="text-sm text-[#6A6D81]">
                © {new Date().getFullYear()} Fasset + Tether. All rights reserved.
              </p>
              <p className="mx-auto max-w-4xl text-xs leading-relaxed text-[#6A6D81]">
                Card services are provided in partnership with licensed financial institutions and Tether,
                pursuant to applicable card network authorizations. All card services are governed by the
                applicable cardholder agreement, fee schedule, and regulatory requirements in your
                jurisdiction. Currency and asset conversions are executed at prevailing market rates at
                the time of transaction through regulated liquidity partners. Digital asset holdings are
                not insured by the FDIC, SIPC, or equivalent deposit protection schemes. The value of
                digital assets may fluctuate significantly, and past performance is not indicative of
                future results. By using our services, you acknowledge that you have read and agree to
                our Terms of Service, Privacy Policy, and AML Policy.
              </p>
            </div>
          </Reveal>
        </div>
      </footer>
    </>
  );
}
