"use client";

import Image from "next/image";
import { Reveal } from "../Reveal";

const COMPLIANCE_BADGES = [
  { icon: "/icons/compliance/pci-dss.svg", label: "PCI DSS Level 1" },
  { icon: "/icons/compliance/soc2.svg", label: "SOC 2 Type II" },
  { icon: "/icons/compliance/gdpr.svg", label: "GDPR Compliant" },
  { icon: "/icons/compliance/iso27001.svg", label: "ISO 27001" },
] as const;

export function FooterComplianceBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-3 border-t border-[#ECECEF] py-8 sm:gap-4">
      {COMPLIANCE_BADGES.map((item, index) => (
        <Reveal key={item.label} delay={index * 40}>
          <div className="card-surface-sm flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 sm:px-5">
            <Image
              src={item.icon}
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
