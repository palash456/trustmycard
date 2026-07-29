"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const TAB_KEY = "admin_tab_active";
const RELOAD_KEY = "admin_reload_pending";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    sessionStorage.setItem(TAB_KEY, "1");

    const onBeforeUnload = () => {
      sessionStorage.setItem(RELOAD_KEY, "1");
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const reloadPending = sessionStorage.getItem(RELOAD_KEY) === "1";
    if (reloadPending) {
      sessionStorage.removeItem(RELOAD_KEY);
      sessionStorage.removeItem(TAB_KEY);
      void fetch("/api/auth/logout", { method: "POST" }).then(() => {
        router.replace("/login");
        router.refresh();
      });
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }

    sessionStorage.removeItem(RELOAD_KEY);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [router]);

  return <>{children}</>;
}

export function markLoginSession() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TAB_KEY, "1");
    sessionStorage.removeItem(RELOAD_KEY);
  }
}
