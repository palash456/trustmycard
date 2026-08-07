"use client";

import Image from "next/image";
import { Reveal } from "../Reveal";

export function SecurityCertificationsBanner() {
  return (
    <section className="border-t border-[#ECECEF] bg-[#F5F5F5] py-10 sm:py-14">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-[#6A6D81] sm:text-base">
            Security Certifications
          </h2>
        </Reveal>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:gap-12 lg:gap-16">
          <Reveal delay={0}>
            <div className="group transition-transform duration-300 hover:-translate-y-1">
              <Image
                src="/icons/compliance/iso-27001-certified.png"
                alt="ISO 27001 Certified by A-LIGN"
                width={140}
                height={186}
                className="h-auto w-[120px] object-contain sm:w-[140px] lg:w-[150px]"
              />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="group transition-transform duration-300 hover:-translate-y-1">
              <Image
                src="/icons/compliance/iso-27701-certified.png"
                alt="ISO 27701 Certified by A-LIGN"
                width={140}
                height={186}
                className="h-auto w-[120px] object-contain sm:w-[140px] lg:w-[150px]"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
