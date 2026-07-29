"use client";

import { useEffect, useState } from "react";

export function useAutoRefresh(intervalMs: number | null) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!intervalMs || intervalMs < 5000) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
