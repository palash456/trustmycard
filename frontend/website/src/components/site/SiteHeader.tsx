"use client";

import Image from "next/image";
import Link from "next/link";

type SiteHeaderProps = {
  getStartedButton: React.ReactNode;
};

export function SiteHeader({ getStartedButton }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#ECECEF] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16 lg:h-20">
          <Link href="/connect" className="flex shrink-0 items-center">
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
            <Link
              href="/connect#features"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              Features
            </Link>
            <Link
              href="/connect#rewards"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              Rewards
            </Link>
            <Link
              href="/connect#premium"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              Premium
            </Link>
            <Link
              href="/frequentlyaskedquestions"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              FAQ
            </Link>
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <div className="relative inline-flex items-center">
              <span className="pointer-events-none absolute left-4 text-sm leading-none">
                🇺🇸
              </span>
              <select
                className="cursor-pointer select-none appearance-none rounded-full border border-[#E3E3E8] bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-zinc-700 outline-none transition-colors hover:bg-neutral-50"
                aria-label="Language"
                defaultValue="en"
              >
                <option value="en">English</option>
              </select>
              <svg
                className="pointer-events-none absolute right-4 h-3.5 w-3.5 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
            {getStartedButton}
          </div>

          <div className="lg:hidden">{getStartedButton}</div>
        </div>
      </div>
    </header>
  );
}
