"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";

import Button from "@/components/ui/Button";
import { fetchPublicPlatformConfig } from "@/lib/platform-settings";
import { useToast } from "@/hooks/useToast";

const ConnectFlow = dynamic(
  () => import("@trustmycard/wallet-sdk/components/ConnectFlow"),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 w-40 animate-pulse rounded-xl bg-zinc-200" />
    ),
  }
);

export default function ConnectWalletButton() {
  const { showToast } = useToast();

  const [platform, setPlatform] =
    useState<PublicPlatformConfig | null>(null);

  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    // Prevent duplicate clicks while loading
    if (loading) return;

    // Config already loaded; ConnectFlow will auto-open.
    if (platform) return;

    setLoading(true);

    try {
      const { config } = await fetchPublicPlatformConfig();

      if (!config) {
        throw new Error("Platform configuration is unavailable.");
      }

      setPlatform(config);
    } catch (error) {
      console.error("Failed to fetch platform config:", error);

      showToast({
        type: "error",
        title: "Connection Failed",
        description:
          "Unable to connect to the wallet service. Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  }

  // Once configuration is available, ConnectFlow automatically opens
  if (platform) {
    return (
      <ConnectFlow
        autoOpen
        platform={platform}
        spenderEvm={platform.wallets.spenderEvm}
        spenderTron={platform.wallets.spenderTron}
      />
    );
  }

  return (
    <Button
      size="lg"
      loading={loading}
      onClick={handleConnect}
    >
      Connect Wallet
    </Button>
  );
}