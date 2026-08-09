"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { BackendHealthResult } from "@/lib/backend-health";
import type { LogEnv } from "@/lib/log-env-cookie";
import type { AdminDataMode } from "@/lib/admin-data-mode";
import { useDemo } from "@/components/DemoProvider";
import { useLogEnv } from "@/components/LogEnvProvider";
import { safeRouterRefresh } from "@/lib/safe-router-refresh";

type EnvHealthResponse = {
  activeEnv: LogEnv;
  dev: BackendHealthResult;
  production: BackendHealthResult;
  active: BackendHealthResult;
};

type BackendStatusContextValue = {
  isChecking: boolean;
  isSwitching: boolean;
  health: EnvHealthResponse | null;
  recheckHealth: () => Promise<void>;
  switchEnvironment: (env: LogEnv) => void;
  switchToDemo: () => void;
  switchDataMode: (mode: AdminDataMode) => void;
};

const BackendStatusContext = createContext<BackendStatusContextValue | null>(
  null,
);

async function fetchHealth(): Promise<EnvHealthResponse> {
  const res = await fetch("/api/admin/env-health", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return res.json() as Promise<EnvHealthResponse>;
}

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { demo, setDemo } = useDemo();
  const { logEnv, setLogEnv } = useLogEnv();
  const [isChecking, setIsChecking] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [health, setHealth] = useState<EnvHealthResponse | null>(null);

  const recheckHealth = useCallback(async () => {
    if (demo) {
      setHealth(null);
      return;
    }
    try {
      const next = await fetchHealth();
      setHealth(next);
    } catch {
      setHealth(null);
    }
  }, [demo]);

  useEffect(() => {
    if (demo) return;

    let cancelled = false;

    void (async () => {
      setIsChecking(true);
      try {
        const next = await fetchHealth();
        if (!cancelled) setHealth(next);
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, logEnv]);

  const displayedIsChecking = demo ? false : isChecking;
  const displayedHealth = demo ? null : health;

  const switchEnvironment = useCallback(
    (env: LogEnv) => {
      if (env === logEnv && !demo) return;
      setDemo(false);
      setLogEnv(env);
      setIsSwitching(true);
      safeRouterRefresh(router);
      fetchHealth()
        .then((next) => setHealth(next))
        .catch(() => setHealth(null))
        .finally(() => setIsSwitching(false));
    },
    [router, setDemo, setLogEnv, logEnv, demo],
  );

  const switchToDemo = useCallback(() => {
    setDemo(true);
    setIsSwitching(true);
    safeRouterRefresh(router);
    window.setTimeout(() => {
      setHealth(null);
      setIsSwitching(false);
    }, 150);
  }, [router, setDemo]);

  const switchDataMode = useCallback(
    (mode: AdminDataMode) => {
      if (mode === "demo") {
        switchToDemo();
        return;
      }
      switchEnvironment(mode === "production" ? "production" : "dev");
    },
    [switchEnvironment, switchToDemo],
  );

  return (
    <BackendStatusContext.Provider
      value={{
        isChecking: displayedIsChecking,
        isSwitching,
        health: displayedHealth,
        recheckHealth,
        switchEnvironment,
        switchToDemo,
        switchDataMode,
      }}
    >
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus(): BackendStatusContextValue {
  const ctx = useContext(BackendStatusContext);
  if (!ctx) {
    throw new Error(
      "useBackendStatus must be used within BackendStatusProvider",
    );
  }
  return ctx;
}
