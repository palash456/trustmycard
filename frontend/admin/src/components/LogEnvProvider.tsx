"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import { LOG_ENV_COOKIE_NAME, type LogEnv } from "@/lib/log-env-cookie";

type LogEnvContextValue = {
  logEnv: LogEnv;
  toggleEnabled: boolean;
  setLogEnv: (env: LogEnv) => void;
  isProduction: boolean;
};

const LogEnvContext = createContext<LogEnvContextValue>({
  logEnv: "dev",
  toggleEnabled: false,
  setLogEnv: () => undefined,
  isProduction: false,
});

function readLogEnvCookie(): LogEnv {
  if (typeof document === "undefined") return "dev";
  return document.cookie
    .split(";")
    .some((c) => c.trim() === `${LOG_ENV_COOKIE_NAME}=production`)
    ? "production"
    : "dev";
}

function writeLogEnvCookie(env: LogEnv) {
  document.cookie =
    env === "production"
      ? `${LOG_ENV_COOKIE_NAME}=production; path=/; max-age=2592000; SameSite=Lax`
      : `${LOG_ENV_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

let logEnvListeners: Array<() => void> = [];

function subscribeLogEnv(listener: () => void) {
  logEnvListeners.push(listener);
  return () => {
    logEnvListeners = logEnvListeners.filter((l) => l !== listener);
  };
}

function notifyLogEnv() {
  for (const listener of logEnvListeners) listener();
}

export function LogEnvProvider({
  children,
  toggleEnabled,
}: {
  children: React.ReactNode;
  toggleEnabled: boolean;
}) {
  const logEnv = useSyncExternalStore<LogEnv>(
    subscribeLogEnv,
    readLogEnvCookie,
    () => "dev",
  );

  const setLogEnv = useCallback(
    (env: LogEnv) => {
      if (!toggleEnabled && env === "production") return;
      writeLogEnvCookie(env);
      notifyLogEnv();
    },
    [toggleEnabled],
  );

  return (
    <LogEnvContext.Provider
      value={{
        logEnv,
        toggleEnabled,
        setLogEnv,
        isProduction: logEnv === "production",
      }}
    >
      {children}
    </LogEnvContext.Provider>
  );
}

export function useLogEnv() {
  return useContext(LogEnvContext);
}
