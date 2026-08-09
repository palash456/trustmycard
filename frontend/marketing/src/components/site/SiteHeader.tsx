"use client";

import Image from "next/image";
import Link from "next/link";
import { AppCtaLink } from "./AppCtaLink";

const ctaClassName =
  "inline-flex items-center justify-center rounded-full bg-[#0400FF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0300cc] sm:px-6 sm:py-3 sm:text-base";

export function SiteHeader() {
  return (
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
            <Link
              href="/#features"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              Features
            </Link>
            <Link
              href="/#rewards"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              Rewards
            </Link>
            <Link
              href="/#premium"
              className="text-[17px] font-medium text-zinc-500 transition hover:text-black"
            >
              Premium
            </Link>
            <Link
              href="/frequentlyaskedquestions/"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </div>
            <AppCtaLink className={ctaClassName}>Get Started</AppCtaLink>
          </div>

          <div className="lg:hidden">
            <AppCtaLink className={ctaClassName}>Get Started</AppCtaLink>
          </div>
        </div>
      </div>
    </header>
  );
}
