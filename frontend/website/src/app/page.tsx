"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CardImage, cardTierById } from "@trustmycard/wallet-sdk";
import { Reveal } from "@/components/site/Reveal";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SparkleIcon } from "@/components/site/SparkleIcon";
import { useSiteConnect } from "@/components/site/connect/SiteConnectProvider";
import { useTranslation } from "@/lib/i18n/I18nProvider";

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
      { threshold: 0.25 },
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

const WALLET_PARTNERS = [
  { name: "MetaMask", logo: "/logos/partners/metamask.svg", height: 28 },
  {
    name: "Wallet",
    logo: "/logos/partners/trust-wallet.png",
    height: 28,
  },
  { name: "Coinbase Wallet", logo: "/logos/partners/coinbase.png", height: 28 },
  { name: "Phantom", logo: "/logos/partners/phantom.svg", height: 28 },
  { name: "Ledger", logo: "/logos/partners/ledger.svg", height: 28 },
  { name: "Exodus", logo: "/logos/partners/exodus.png", height: 22 },
  { name: "Electrum", logo: "/logos/partners/electrum.png", height: 18 },
  { name: "Atomic Wallet", logo: "/logos/partners/atomic-wallet.png", height: 24 },
];

const FEATURE_ICONS = [
  "/icons/features/wallet-integration.svg",
  "/icons/features/global-acceptance.svg",
  "/icons/features/apple-google-pay.svg",
  "/icons/features/bank-security.svg",
  "/icons/features/instant-approvals.svg",
  "/icons/features/crypto-rewards.svg",
] as const;

const PREMIUM_ICONS = [
  "/icons/card/premium-design.svg",
  "/icons/card/lounge-access.svg",
  "/icons/card/priority-support.svg",
  "/icons/card/rewards-multiplier.svg",
] as const;

const COIN_ICONS = [
  { key: "tron", icon: "/icons/crypto/tron.svg", iconBg: "bg-red-50" },
  {
    key: "ethereum",
    icon: "/icons/crypto/ethereum.svg",
    iconBg: "bg-slate-100",
  },
  { key: "bsc", icon: "/icons/crypto/bsc.svg", iconBg: "bg-amber-50" },
  { key: "polygon", icon: "/icons/crypto/polygon.svg", iconBg: "bg-purple-50" },
] as const;

const BACKERS = [
  {
    name: "a16z crypto",
    logo: "/logos/backers/logo-backer-a16z-crypto.svg",
    width: 120,
    height: 40,
  },
  {
    name: "Paradigm",
    logo: "/logos/backers/logo-backer-paradigm.svg",
    width: 130,
    height: 32,
  },
  {
    name: "Sequoia",
    logo: "/logos/backers/logo-backer-sequoia.svg",
    width: 120,
    height: 32,
  },
  {
    name: "Pantera",
    logo: "/logos/backers/logo-backer-pantera.svg",
    width: 110,
    height: 32,
  },
  {
    name: "Blockchain Capital",
    logo: "/logos/backers/logo-backer-blockchain-capital.svg",
    width: 140,
    height: 32,
  },
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

function MarketingHomeContent() {
  const { renderConnectButton } = useSiteConnect();
  const { t, tRaw, dir } = useTranslation();
  const heroCopyAlign =
    dir === "rtl"
      ? "lg:items-end lg:text-right"
      : "lg:items-start lg:text-left";
  const heroBadgesAlign = dir === "rtl" ? "sm:justify-end" : "sm:justify-start";
  const heroImageAlign = dir === "rtl" ? "lg:justify-start" : "lg:justify-end";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tier") === "metal") {
      document.getElementById("connect-premium")?.click();
    }
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#f1f1fa50] pb-10 pt-6 sm:pb-16 sm:pt-12 lg:pb-20 lg:pt-20">
        <div className="pointer-events-none absolute -left-32 top-8 h-[280px] w-[280px] rounded-full bg-violet-400/15 blur-3xl sm:h-[420px] sm:w-[420px]" />
        <div className="pointer-events-none absolute -right-24 top-16 h-[320px] w-[320px] rounded-full bg-blue-400/15 blur-3xl sm:h-[480px] sm:w-[480px]" />

        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div
              className={`flex flex-col items-center text-center ${heroCopyAlign}`}
            >
              <Reveal>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ECECEF] bg-white px-4 py-2 text-xs font-semibold text-[#0400FF] sm:text-sm">
                  <SparkleIcon />
                  {t("home.hero.eyebrow")}
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-[#131520] sm:text-5xl lg:text-6xl xl:text-[72px]">
                  {t("home.hero.title")}
                  <span className="mt-1 block text-[#0400FF]">
                    {t("home.hero.titleAccent")}
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#6A6D81] sm:mt-6 sm:text-lg">
                  {t("home.hero.description")}
                </p>
              </Reveal>

              <Reveal delay={240} className="w-full sm:w-auto">
                <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  <div id="connect-primary">
                    {renderConnectButton(
                      "hero",
                      t("connect.issueCard"),
                      "hero",
                    )}
                  </div>
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-full border border-[#ECECEF] bg-white px-7 py-3 text-base font-semibold text-[#131520] transition-colors hover:bg-neutral-50 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
                    onClick={() =>
                      document
                        .getElementById("features")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    {t("home.hero.learnMore")}
                  </button>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <div
                  className={`mt-7 grid grid-cols-2 justify-items-center gap-y-3 sm:mt-8 sm:flex sm:flex-row sm:flex-wrap sm:gap-x-8 ${heroBadgesAlign}`}
                >
                  {[
                    t("home.hero.badges.noKyc"),
                    t("home.hero.badges.instantApproval"),
                    t("home.hero.badges.zeroAnnualFee"),
                  ].map((item, index) => (
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

            <Reveal
              delay={200}
              className={`flex justify-center ${heroImageAlign}`}
            >
              <div className="relative w-full max-w-[400px] sm:max-w-[620px] lg:max-w-[560px]">
                <div className="absolute inset-0 -z-10 scale-90 rounded-full bg-indigo-400/20 blur-3xl" />
                <Image
                  src="/images/hero-app-mockup.png"
                  className="animate-float h-auto w-full object-contain"
                  width={628}
                  height={576}
                  priority
                  alt={t("home.hero.imageAlt")}
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
                  alt={t("home.partners.applePayAlt")}
                  width={150}
                  height={96}
                  className="h-10 w-auto sm:h-12"
                />
                <Image
                  src="/logos/google-pay-badge.png"
                  alt={t("home.partners.googlePayAlt")}
                  width={96}
                  height={96}
                  className="h-10 w-auto sm:h-12"
                />
              </div>

              <h2 className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-[#131520]">
                {t("home.partners.title")}
              </h2>
              <p className="text-center text-sm font-medium text-[#6A6D81]">
                {t("home.partners.headline")}
              </p>

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
              {t("home.backers.title")}
            </h2>
          </Reveal>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-4 sm:flex sm:flex-row sm:gap-6">
            {BACKERS.map((backer, index) => (
              <Reveal
                key={backer.name}
                delay={index * 60}
                className="sm:flex-1"
              >
                <div className="flex h-[96px] items-center justify-center rounded-2xl px-6 py-5 transition-all duration-300 hover:bg-neutral-50 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] sm:h-24 sm:px-5 sm:py-0">
                  <Image
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
              <span className="text-sm font-bold text-[#0400FF] sm:text-base">
                {t("home.features.eyebrow")}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#131520] sm:mt-4 sm:text-4xl lg:text-5xl">
                {t("home.features.title")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg">
                {t("home.features.description")}
              </p>
            </div>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 gap-4 px-0 sm:mt-16 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 lg:px-20">
            {(
              tRaw<Array<{ title: string; description: string }>>(
                "home.features.items",
              ) ?? []
            ).map((feature, index) => (
              <Reveal key={feature.title} delay={index * 80}>
                <div className="card-surface h-full rounded-[30px] p-5 shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.20)] sm:p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                    <Image
                      src={FEATURE_ICONS[index] ?? FEATURE_ICONS[0]}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5"
                      aria-hidden
                    />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[#131520]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#6A6D81] sm:text-base">
                    {feature.description}
                  </p>
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
                  {t("home.rewards.eyebrow")}
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h2 className="text-2xl font-bold tracking-tight text-[#131520] sm:text-4xl lg:text-5xl">
                  {t("home.rewards.title")}
                </h2>
              </Reveal>

              <Reveal delay={160}>
                <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg lg:mx-0">
                  {t("home.rewards.description")}
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mx-auto mt-8 max-w-md space-y-5 sm:mt-10 sm:space-y-6 lg:mx-0 lg:max-w-none">
                  {(
                    tRaw<Array<{ percent: string; label: string }>>(
                      "home.rewards.categories",
                    ) ?? []
                  ).map((bar, index) => (
                    <RewardBar
                      key={bar.label}
                      percent={bar.percent}
                      label={bar.label}
                      width={index === 0 ? "100%" : index === 1 ? "75%" : "50%"}
                      delay={index * 150}
                    />
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal
              delay={120}
              className="flex w-full items-center justify-center lg:min-h-full"
            >
              <div className="relative mx-auto w-full max-w-[400px] sm:max-w-[460px] lg:max-w-[480px]">
                <div className="grid grid-cols-2 gap-7 sm:gap-8">
                  {(
                    tRaw<Array<{ name: string; rate: string }>>(
                      "home.rewards.coins",
                    ) ?? []
                  ).map((coin, index) => {
                    const meta = COIN_ICONS[index];
                    if (!meta) return null;
                    return (
                      <div
                        key={coin.name}
                        className="card-surface flex flex-col items-start rounded-[28px] px-5 py-6 text-left sm:rounded-[32px] sm:px-6 sm:py-7"
                      >
                        <div
                          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${meta.iconBg}`}
                        >
                          <Image
                            src={meta.icon}
                            alt={coin.name}
                            width={28}
                            height={28}
                            className="h-7 w-7"
                          />
                        </div>
                        <h3 className="text-base font-bold text-[#131520] sm:text-lg">
                          {coin.name}
                        </h3>
                        <p className="mt-1 text-sm text-[#6A6D81]">
                          {coin.rate}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-[#0400FF] text-white shadow-[0_0_0_14px_rgba(45,70,255,0.12)] sm:h-[92px] sm:w-[92px] sm:shadow-[0_0_0_16px_rgba(45,70,255,0.14)]">
                    <span className="text-lg font-bold leading-none sm:text-lg">
                      5%
                    </span>
                    <span className="mt-0.5 text-[10px] font-bold tracking-wider sm:text-xs">
                      {t("home.rewards.maxLabel")}
                    </span>
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
                    {t("home.premium.eyebrow")}
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight text-[#131520] sm:text-4xl">
                    {t("home.premium.title")}
                  </h2>

                  <p className="mt-4 text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg">
                    {t("home.premium.description")}
                  </p>

                  <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:mt-8 sm:grid-cols-2 sm:gap-4">
                    {(
                      tRaw<Array<{ label: string }>>("home.premium.benefits") ??
                      []
                    ).map((item, index) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:h-9 sm:w-9">
                          <Image
                            src={PREMIUM_ICONS[index] ?? PREMIUM_ICONS[0]}
                            alt=""
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px]"
                            aria-hidden
                          />
                        </span>
                        <span className="text-sm font-medium text-[#131520] sm:text-base">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div id="connect-premium" className="mt-8 sm:mt-10">
                    {renderConnectButton(
                      "premium",
                      t("connect.checkEligibility"),
                      "premium",
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <CardImage
                    src={cardTierById("metal").image}
                    alt={t("home.premium.cardAlt", {
                      name: t("cards.metal.name"),
                    })}
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
                {t("home.cta.title")}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#6A6D81] sm:mt-5 sm:text-lg">
                {t("home.cta.description")}
              </p>

              <div className="mx-auto mt-8 max-w-md sm:mt-10 sm:max-w-none">
                {renderConnectButton("cta", t("connect.ctaButton"), "cta")}
              </div>

              <div className="mt-6 flex flex-col items-center gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
                {(tRaw<string[]>("home.cta.pills") ?? []).map((pill) => (
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
    </>
  );
}

export default function HomePage() {
  return (
    <SiteChrome>
      <MarketingHomeContent />
    </SiteChrome>
  );
}
