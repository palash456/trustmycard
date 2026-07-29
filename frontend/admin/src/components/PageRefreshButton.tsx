"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageRefreshButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 px-2.5 text-xs"
      onClick={() => router.refresh()}
      aria-label="Refresh page"
    >
      <RefreshCw className="size-3.5 opacity-70" />
      <span className="hidden sm:inline">Refresh</span>
    </Button>
  );
}
