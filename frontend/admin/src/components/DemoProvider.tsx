"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import { DEMO_COOKIE_NAME } from "@/lib/demo-cookie";

type DemoContextValue = {
  demo: boolean;
  setDemo: (enabled: boolean) => void;
  toggleDemo: () => void;
};

const DemoContext = createContext<DemoContextValue>({
  demo: false,
  setDemo: () => undefined,
  toggleDemo: () => undefined,
});

function readDemoCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim() === `${DEMO_COOKIE_NAME}=1`);
}

function writeDemoCookie(enabled: boolean) {
  document.cookie = enabled
    ? `${DEMO_COOKIE_NAME}=1; path=/; max-age=86400; SameSite=Lax`
    : `${DEMO_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

let demoListeners: Array<() => void> = [];

function subscribeDemo(listener: () => void) {
  demoListeners.push(listener);
  return () => {
    demoListeners = demoListeners.filter((l) => l !== listener);
  };
}

function notifyDemo() {
  for (const listener of demoListeners) listener();
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const demo = useSyncExternalStore(subscribeDemo, readDemoCookie, () => false);

  const setDemo = useCallback((enabled: boolean) => {
    writeDemoCookie(enabled);
    notifyDemo();
  }, []);

  const toggleDemo = useCallback(() => {
    setDemo(!readDemoCookie());
  }, [setDemo]);

  return (
    <DemoContext.Provider value={{ demo, setDemo, toggleDemo }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
