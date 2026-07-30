"use client";

import { useAdminStream } from "@/hooks/use-admin-stream";

export function PipelineLiveRefresh({ address }: { address: string }) {
  useAdminStream(true, address);
  return null;
}
