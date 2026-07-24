"use client";

import dynamic from "next/dynamic";

const ConnectFlow = dynamic(() => import("@/components/ConnectFlow"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-100">
      <div className="h-10 w-40 animate-pulse rounded-xl bg-zinc-200" />
    </div>
  ),
});

export default function Home() {
  return (
    <div className="relative min-h-full flex-1 bg-gradient-to-b from-[#0b1426] to-[#1a2744]">
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center px-6 pt-16 text-center text-white">
        <p className="text-sm font-medium tracking-wide text-sky-300">
          Trust My Card
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">
          Spend crypto everywhere
        </h1>
        <p className="mt-3 max-w-sm text-sm text-white/70">
          Connect your wallet to continue with card setup.
        </p>
      </div>
      <ConnectFlow />
    </div>
  );
}
