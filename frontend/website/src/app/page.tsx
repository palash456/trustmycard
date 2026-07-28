"use client";

import dynamic from "next/dynamic";

const ConnectFlow = dynamic(
  () =>
    import("@trustmycard/wallet-sdk").then((m) => m.ConnectFlow),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <div className="h-11 w-40 animate-pulse rounded-xl bg-zinc-200" />
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 px-4">
      {/* Optional: spenderEvm / spenderTron — otherwise uses .env.local */}
      <ConnectFlow />
    </main>
  );
}
