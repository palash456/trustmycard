"use client";

import Image from "next/image";
import { Reveal } from "../Reveal";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export function FooterLicensedIssuer() {
  const { t, tRaw } = useTranslation();
  const regions =
    tRaw<
      Array<{
        flag: string;
        country: string;
        badge: string;
        license: string;
        address: string;
      }>
    >("footer.regions") ?? [];

  return (
    <div className="border-t border-[#ECECEF] py-10 sm:py-12">
      <Reveal>
        <div className="mb-6 flex items-center gap-2">
          <Image
            src="/icons/compliance/licensed-card-issuer.svg"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5"
            aria-hidden
          />
          <span className="text-base font-bold text-[#131520]">
            {t("footer.licensedIssuer.title")}
          </span>
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {regions.map((item, index) => (
          <Reveal key={item.country} delay={80 + index * 60}>
            <div className="card-surface-sm flex h-full flex-col rounded-2xl p-5 sm:p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-2xl leading-none sm:text-3xl">
                  {item.flag}
                </span>
                <span className="text-base font-bold text-[#131520] sm:text-lg">
                  {item.country}
                </span>
              </div>
              <span className="mb-2 inline-block w-fit rounded-full bg-[#0400FF]/10 px-3 py-1 text-xs font-bold text-[#0400FF]">
                {item.badge}
              </span>
              <span className="mb-2 text-xs text-[#6A6D81]">
                {item.license}
              </span>
              <span className="whitespace-pre-line text-sm leading-relaxed text-[#6A6D81]">
                {item.address}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
