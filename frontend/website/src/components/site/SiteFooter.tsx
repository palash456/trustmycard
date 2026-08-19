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
            <div className="flex flex-col gap-12 py-12 sm:py-16 lg:flex-row lg:items-start lg:gap-16 xl:gap-24 lg:py-20">
              <div className="shrink-0 lg:w-[min(100%,280px)] xl:w-[300px]">
                <Image
                  src="/logos/main.png"
                  alt={t("brand.name")}
                  width={210}
                  height={44}
                  className="h-7 w-auto opacity-90 sm:h-12 sm:w-auto"
                />
                <p className="mt-4 text-sm leading-relaxed text-[#6A6D81]">
                  {t("footer.tagline")}
                </p>
                <DownloadChips />
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 sm:gap-8 lg:gap-10 xl:gap-4">
                <AboutSection />
                <div className="min-w-0">
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
