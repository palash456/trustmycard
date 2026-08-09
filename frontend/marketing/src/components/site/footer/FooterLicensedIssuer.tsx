"use client";

import Image from "next/image";
import { Reveal } from "../Reveal";

const LICENSED_REGIONS = [
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
] as const;

export function FooterLicensedIssuer() {
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
            Licensed Card Issuer
          </span>
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LICENSED_REGIONS.map((item, index) => (
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
