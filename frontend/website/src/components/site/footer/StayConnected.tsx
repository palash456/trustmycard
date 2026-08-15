"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import {
  FacebookIcon,
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  RedditIcon,
  XIcon,
  YoutubeIcon,
} from "../icons/BrandIcons";
import { useTranslation } from "@/lib/i18n/I18nProvider";

const SOCIAL_ICONS = [
  FacebookIcon,
  GithubIcon,
  InstagramIcon,
  XIcon,
  RedditIcon,
  Send,
  LinkedinIcon,
  YoutubeIcon,
] as const;

export function StayConnectedSection() {
  const { t, tRaw } = useTranslation();
  const social =
    tRaw<Array<{ label: string; followText: string; href: string }>>(
      "footer.social",
    ) ?? [];

  return (
    <div className="min-w-0 lg:pr-10 xl:pr-14">
      <h3 className="text-sm font-semibold text-[#131520]">
        {t("footer.stayConnected")}
      </h3>
      <ul className="mt-4 space-y-2">
        {social.map(({ label, followText, href }, index) => {
          const Icon = SOCIAL_ICONS[index];
          if (!Icon) return null;
          return (
            <li key={label}>
              <a
                href={href}
                aria-label={followText}
                className="group flex items-center gap-2.5 rounded-lg py-1 transition-colors duration-200"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#ECECEF] bg-white text-[#6A6D81] transition-all duration-200 group-hover:border-[#0400FF]/30 group-hover:bg-[#0400FF]/5 group-hover:text-[#0400FF]">
                  <Icon className="h-[15px] w-[15px]" />
                </span>
                <span className="min-w-0 text-sm leading-snug text-[#6A6D81] transition-colors duration-200 group-hover:text-[#0400FF]">
                  {followText}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AboutSection() {
  const { t, tRaw } = useTranslation();
  const links =
    tRaw<Array<{ label: string; href: string }>>("footer.about.links") ?? [];

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-[#131520]">
        {t("footer.about.title")}
      </h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
            >
              <span className="relative">
                {link.label}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FooterLegalLinks() {
  const { t } = useTranslation();

  return (
    <ul className="mt-4 space-y-3">
      <li>
        <Link
          href="/frequentlyaskedquestions"
          className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
        >
          <span className="relative">
            {t("footer.legal.faq")}
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
          </span>
        </Link>
      </li>
      <li>
        <Link
          href="/privacypolicy"
          className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
        >
          <span className="relative">
            {t("footer.legal.privacy")}
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
          </span>
        </Link>
      </li>
      <li>
        <Link
          href="/termsandconditions"
          className="group inline-flex text-sm text-[#6A6D81] transition-colors duration-200 hover:text-[#0400FF]"
        >
          <span className="relative">
            {t("footer.legal.terms")}
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#0400FF] transition-all duration-200 group-hover:w-full" />
          </span>
        </Link>
      </li>
    </ul>
  );
}
