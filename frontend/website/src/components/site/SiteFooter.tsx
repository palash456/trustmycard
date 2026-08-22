"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./Reveal";
import {
  AboutSection,
  FooterLegalLinks,
  StayConnectedSection,
} from "./footer/StayConnected";
import { SecurityCertificationsBanner } from "./footer/SecurityCertificationsBanner";
import { DownloadChips } from "./footer/DownloadWallet";
import { FooterLicensedIssuer } from "./footer/FooterLicensedIssuer";
import { FooterComplianceBadges } from "./footer/FooterComplianceBadges";
import { FooterContact } from "./footer/FooterContact";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <>
      <SecurityCertificationsBanner />

      <footer className="border-t border-[#ECECEF] bg-[#F9FAFB]">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
          <div className="flex flex-col gap-12 py-12 sm:py-16 lg:flex-row lg:items-start lg:justify-between lg:gap-14 lg:pr-12 xl:gap-20 lg:py-20">              <div className="shrink-0 lg:max-w-[min(100%,340px)]">
                <Image
                  src="/logos/main.png"
                  alt={t("brand.name")}
                  width={1507}
                  height={328}
                  className="h-10 w-auto sm:h-8 lg:h-10"
                  unoptimized
                />
                <p className="my-6 text-sm leading-relaxed text-[#6A6D81]">
                  {t("footer.tagline")}
                </p>
                <DownloadChips />
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-10 sm:grid-cols-2 lg:flex lg:w-full lg:flex-1 lg:justify-between lg:gap-10 xl:gap-14 2xl:gap-20">
                <AboutSection />
                <div className="min-w-0 lg:flex-1">
                  <h3 className="text-sm font-semibold text-[#131520]">
                    {t("footer.legal.title")}
                  </h3>
                  <FooterLegalLinks />
                </div>
                <FooterContact />
                <StayConnectedSection />
              </div>
            </div>
          </Reveal>

          <FooterLicensedIssuer />
          <FooterComplianceBadges />

          <Reveal delay={160}>
            <div className="flex flex-col items-center gap-4 border-t border-[#ECECEF] py-8 text-center">
              <p className="text-sm text-[#6A6D81]">
                {t("footer.copyright", { year: new Date().getFullYear() })}
              </p>
              <p className="mx-auto max-w-4xl text-xs leading-relaxed text-[#6A6D81]">
                {t("footer.disclaimer")}{" "}
                <Link
                  href="/termsandconditions"
                  className="underline hover:text-[#131520]"
                >
                  {t("footer.disclaimerTerms")}
                </Link>
                ,{" "}
                <Link
                  href="/privacypolicy"
                  className="underline hover:text-[#131520]"
                >
                  {t("footer.disclaimerPrivacy")}
                </Link>
                , and {t("footer.amlPolicy")}.
              </p>
            </div>
          </Reveal>
        </div>
      </footer>
    </>
  );
}
