"use client";

import Image from "next/image";
import { Reveal } from "../Reveal";
import { useTranslation } from "@/lib/i18n/I18nProvider";

const COMPLIANCE_ICONS = [
  "/icons/compliance/pci-dss.svg",
  "/icons/compliance/soc2.svg",
  "/icons/compliance/gdpr.svg",
  "/icons/compliance/iso27001.svg",
] as const;

export function FooterComplianceBadges() {
  const { tRaw } = useTranslation();
  const badges = tRaw<Array<{ label: string }>>("footer.compliance") ?? [];

  return (
    <div className="flex flex-wrap justify-center gap-3 border-t border-[#ECECEF] py-8 sm:gap-4">
      {badges.map((item, index) => (
        <Reveal key={item.label} delay={index * 40}>
          <div className="card-surface-sm flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 sm:px-5">
            <Image
              src={COMPLIANCE_ICONS[index] ?? COMPLIANCE_ICONS[0]}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4"
              aria-hidden
            />
            <span className="text-xs text-[#6A6D81] sm:text-sm">
              {item.label}
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
