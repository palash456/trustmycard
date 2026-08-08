import { startTransition } from "react";

/** Avoid "Router action dispatched before initialization" during HMR or rapid toggles. */
export function safeRouterRefresh(router: { refresh: () => void }) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    startTransition(() => {
      try {
        router.refresh();
      } catch {
        // Router not ready yet — ignore (e.g. Turbopack HMR)
      }
    });
  }, 0);
}
