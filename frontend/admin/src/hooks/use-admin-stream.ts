"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useAdminStream(enabled = true) {
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
        const event = JSON.parse(msg.data) as { type?: string };
        if (
          event.type === "settings.updated" ||
          event.type === "collector.updated" ||
          event.type === "collector.tick" ||
          event.type === "audit.created" ||
          event.type === "transfer.updated" ||
          event.type === "native_transfer.updated" ||
          event.type === "approval.updated"
        ) {
          routerRef.current.refresh();
        }
      } catch {
        // ignore malformed events
      }
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}
