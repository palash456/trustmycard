"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const REFRESH_EVENTS = new Set([
  "settings.updated",
  "collector.updated",
  "collector.tick",
  "audit.created",
  "transfer.updated",
  "native_transfer.updated",
  "approval.updated",
  "collection.intent.updated",
  "user.updated",
]);

function eventMatchesScope(
  event: { type?: string; payload?: unknown },
  scopeAddress?: string
): boolean {
  if (!scopeAddress) return true;
  const normalized = scopeAddress.toLowerCase();
  const payload = (event.payload ?? {}) as { address?: string; ownerAddress?: string };
  if (event.type === "user.updated") {
    return payload.address?.toLowerCase() === normalized;
  }
  if (
    event.type === "transfer.updated" ||
    event.type === "native_transfer.updated" ||
    event.type === "approval.updated" ||
    event.type === "collection.intent.updated"
  ) {
    if (payload.ownerAddress) {
      return payload.ownerAddress.toLowerCase() === normalized;
    }
    return false;
  }
  return false;
}

export function useAdminStream(enabled = true, scopeAddress?: string) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/admin/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as { type?: string; payload?: unknown };
        if (!event.type || !REFRESH_EVENTS.has(event.type)) return;
        if (scopeAddress) {
          if (!eventMatchesScope(event, scopeAddress)) return;
        }
        routerRef.current.refresh();
      } catch {
        // ignore malformed events
      }
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, [enabled, scopeAddress]);

  return { connected };
}
