"use client";

import Image from "next/image";
import { useEffect } from "react";
import { SiteChrome } from "@/components/site/SiteChrome";
import { useSiteConnect } from "@/components/site/connect/SiteConnectProvider";

function ConnectLanding() {
  const { renderConnectButton } = useSiteConnect();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tier = params.get("tier");
    if (tier === "metal") {
      const btn = document.getElementById("connect-primary");
      btn?.click();
    }
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#f1f1fa50] py-16 sm:py-24 lg:py-28">
      <div className="pointer-events-none absolute -left-32 top-8 h-[280px] w-[280px] rounded-full bg-violet-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-16 h-[320px] w-[320px] rounded-full bg-blue-400/15 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center sm:px-6">
        <Image
          src="/logos/main.png"
          alt="Trust Card"
          width={210}
          height={44}
          className="h-8 w-auto sm:h-10"
          priority
        />
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-[#131520] sm:text-4xl lg:text-5xl">
          Connect your wallet
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6A6D81] sm:text-lg">
          Issue your Trust Card in seconds. Link supported networks, authorize spending, and
          start using crypto at millions of merchants worldwide.
        </p>
        <div id="connect-primary" className="mt-10 w-full max-w-sm">
          {renderConnectButton("hero", "Issue Card", "hero")}
        </div>
        <p className="mt-6 text-xs text-[#9CA3AF] sm:text-sm">
          Marketing site:{" "}
          <a
            href={process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://trustmycard.com"}
            className="underline hover:text-[#131520]"
          >
            trustmycard.com
          </a>
        </p>
      </div>
    </section>
  );
}

export default function ConnectPage() {
  return (
    <SiteChrome>
      <ConnectLanding />
    </SiteChrome>
  );
}
