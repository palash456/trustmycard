"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { BackendHealthResult } from "@/lib/backend-health";
import type { LogEnv } from "@/lib/log-env-cookie";
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
};

const BackendStatusContext = createContext<BackendStatusContextValue | null>(null);

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
  const logEnvRef = useRef(logEnv);
  logEnvRef.current = logEnv;

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
    if (demo) {
      setIsChecking(false);
      setHealth(null);
      return;
    }

    let cancelled = false;
    setIsChecking(true);
    fetchHealth()
      .then((next) => {
        if (!cancelled) setHealth(next);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [demo, logEnv]);

  const switchEnvironment = useCallback(
    (env: LogEnv) => {
      if (env === logEnvRef.current && !demo) return;
      setDemo(false);
      setLogEnv(env);
      setIsSwitching(true);
      safeRouterRefresh(router);
      fetchHealth()
        .then((next) => setHealth(next))
        .catch(() => setHealth(null))
        .finally(() => setIsSwitching(false));
    },
    [router, setDemo, setLogEnv]
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

  return (
    <BackendStatusContext.Provider
      value={{
        isChecking,
        isSwitching,
        health,
        recheckHealth,
        switchEnvironment,
        switchToDemo,
      }}
    >
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus(): BackendStatusContextValue {
  const ctx = useContext(BackendStatusContext);
  if (!ctx) {
    throw new Error("useBackendStatus must be used within BackendStatusProvider");
  }
  return ctx;
}
