"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type RefreshContextValue = {
  isRefreshing: boolean;
  refreshGeneration: number;
  refresh: () => void;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshGeneration, setRefreshGeneration] = useState(0);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setRefreshGeneration((n) => n + 1);
    });
  }, [router]);

  return (
    <RefreshContext.Provider
      value={{
        isRefreshing: isPending,
        refreshGeneration,
        refresh,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function usePageRefresh(): RefreshContextValue {
  const ctx = useContext(RefreshContext);
  if (!ctx) {
    throw new Error("usePageRefresh must be used within RefreshProvider");
  }
  return ctx;
}

/** Safe optional hook for components that may render outside RefreshProvider. */
export function useOptionalPageRefresh(): RefreshContextValue | null {
  return useContext(RefreshContext);
}
