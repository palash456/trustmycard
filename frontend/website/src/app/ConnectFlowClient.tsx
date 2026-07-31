"use client";

import dynamic from "next/dynamic";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

const ConnectFlow = dynamic(
  () => import("@trustmycard/wallet-sdk/components/ConnectFlow"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <div className="h-11 w-40 animate-pulse rounded-xl bg-zinc-200" />
      </div>
    ),
  }
);

export default function Home({ platform }: { platform: PublicPlatformConfig }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-4">
      <ConnectFlow
        platform={platform}
        spenderEvm={platform.wallets.spenderEvm}
        spenderTron={platform.wallets.spenderTron}
      />
    </main>
  );
}
