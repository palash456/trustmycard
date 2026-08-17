"use client";

import Image from "next/image";
import Link from "next/link";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LanguageSelector } from "./LanguageSelector";

type SiteHeaderProps = {
  getStartedButton: React.ReactNode;
};

export function SiteHeader({ getStartedButton }: SiteHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-[#ECECEF] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16 lg:h-20">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/logos/main.png"
              alt={t("brand.name")}
              width={210}
              height={44}
              className="h-7 w-auto sm:h-8 lg:h-10"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-14 lg:flex">
            <Link
              href="/#features"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              {t("nav.features")}
            </Link>
            <Link
              href="/#rewards"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              {t("nav.rewards")}
            </Link>
            <Link
              href="/#premium"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              {t("nav.premium")}
            </Link>
            <Link
              href="/frequentlyaskedquestions"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              {t("nav.faq")}
            </Link>
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <LanguageSelector />
            {getStartedButton}
          </div>

          <div className="flex items-stretch gap-2 lg:hidden">
            <LanguageSelector className="h-full shrink-0" />
            {getStartedButton}
          </div>
        </div>
      </div>
    </header>
  );
}
