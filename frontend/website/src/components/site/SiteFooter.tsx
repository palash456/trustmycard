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

export function SiteFooter() {
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
                  alt="Trust Card"
                  width={210}
                  height={44}
                  className="h-7 w-auto opacity-90 sm:h-12 sm:w-auto"
                />
                <p className="mt-4 text-sm leading-relaxed text-[#6A6D81]">
                  Spend crypto at millions of merchants worldwide. Connect your wallet,
                  choose your Black Card, Silver Hybrid Card, or Metal Premium Card, and
                  earn rewards on every purchase.
                </p>
                <DownloadChips />
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8 lg:gap-10 xl:gap-4">
                <AboutSection />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#131520]">Legal</h3>
                  <FooterLegalLinks />
                </div>
                <StayConnectedSection />
              </div>
            </div>
          </Reveal>

          <FooterLicensedIssuer />
          <FooterComplianceBadges />

          <Reveal delay={160}>
            <div className="flex flex-col items-center gap-4 border-t border-[#ECECEF] py-8 text-center">
              <p className="text-sm text-[#6A6D81]">
                © {new Date().getFullYear()} Fasset + Tether. All rights reserved.
              </p>
              <p className="mx-auto max-w-4xl text-xs leading-relaxed text-[#6A6D81]">
                Card services are provided in partnership with licensed financial
                institutions and Tether, pursuant to applicable card network
                authorizations. Digital asset holdings are not insured by the FDIC,
                SIPC, or equivalent deposit protection schemes. By using our services,
                you acknowledge that you have read and agree to our{" "}
                <Link href="/connect/termsandconditions" className="underline hover:text-[#131520]">
                  Terms &amp; Conditions
                </Link>
                ,{" "}
                <Link href="/connect/privacypolicy" className="underline hover:text-[#131520]">
                  Privacy Policy
                </Link>
                , and AML Policy.
              </p>
            </div>
          </Reveal>
        </div>
      </footer>
    </>
  );
}
