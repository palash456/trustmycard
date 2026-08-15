import type { Metadata } from "next";

import { FaqAccordion } from "@/components/site/FaqAccordion";
import { Reveal } from "@/components/site/Reveal";
import { SiteChrome } from "@/components/site/SiteChrome";
import { FAQ_CATEGORIES } from "@/content/faq";

export const metadata: Metadata = {
  title: "FAQ | Trust Card",
  description:
    "Answers to common questions about Trust Card, wallet connection, Black Card tiers, rewards, and security.",
};

export default function FrequentlyAskedQuestionsPage() {
  return (
    <SiteChrome>
      <div className="bg-[#F9FAFB]">
        <section className="relative overflow-hidden border-b border-[#ECECEF] bg-white pb-12 pt-10 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16">
          <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />

          <div className="relative mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal>
              <div className="inline-flex rounded-full border border-[#ECECEF] bg-white px-4 py-2 text-xs font-semibold text-[#0400FF] sm:text-sm">
                Help Center
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#131520] sm:text-4xl lg:text-5xl">
                Frequently Asked Questions
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#6A6D81] sm:text-lg">
                Everything you need to know about issuing your Black Card,
                connecting your wallet, earning rewards, and spending crypto
                worldwide.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="py-12 sm:py-16 lg:py-20">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
            <FaqAccordion categories={FAQ_CATEGORIES} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
