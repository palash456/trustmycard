"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Lock, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getDeveloperProtectedPrefix,
  isDeveloperProtectedRoute,
  type DeveloperProtectedPrefix,
} from "@/lib/developer-mode";

type DeveloperModeContextValue = {
  tryNavigate: (href: string) => void;
  isProtectedRoute: (href: string) => boolean;
  isRouteUnlocked: (href: string) => boolean;
};

const DeveloperModeContext = createContext<DeveloperModeContextValue | null>(
  null,
);

export function useDeveloperMode(): DeveloperModeContextValue {
  const ctx = useContext(DeveloperModeContext);
  if (!ctx) {
    throw new Error(
      "useDeveloperMode must be used within DeveloperModeProvider",
    );
  }
  return ctx;
}

function DeveloperModeModal({
  open,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) setPassword("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(password);
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="developer-mode-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border bg-popover shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="size-4" />
            </span>
            <div>
              <h2
                id="developer-mode-title"
                className="text-base font-semibold text-foreground"
              >
                Developer mode
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter the developer password to access this area.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid gap-2">
            <Label htmlFor="developer-mode-password">Developer password</Label>
            <Input
              id="developer-mode-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              autoFocus={open}
              required
              className="h-10"
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Unlock"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export function DeveloperModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [unlockedPrefixes, setUnlockedPrefixes] = useState<
    Set<DeveloperProtectedPrefix>
  >(() => new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlockedRef = useRef(unlockedPrefixes);
  unlockedRef.current = unlockedPrefixes;

  const currentPrefix = getDeveloperProtectedPrefix(pathname);
  const isCurrentRouteUnlocked =
    currentPrefix !== null && unlockedPrefixes.has(currentPrefix);

  const unlockPrefix = useCallback((prefix: DeveloperProtectedPrefix) => {
    setUnlockedPrefixes((prev) => new Set(prev).add(prefix));
  }, []);

  const openModalFor = useCallback((href: string) => {
    setPendingHref(href);
    setError(null);
    setModalOpen(true);
  }, []);

  const tryNavigate = useCallback(
    (href: string) => {
      const prefix = getDeveloperProtectedPrefix(href);
      if (!prefix) {
        router.push(href);
        return;
      }
      if (unlockedPrefixes.has(prefix)) {
        router.push(href);
        return;
      }
      openModalFor(href);
    },
    [openModalFor, router, unlockedPrefixes],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPendingHref(null);
    setError(null);
    if (
      currentPrefix &&
      !unlockedPrefixes.has(currentPrefix) &&
      isDeveloperProtectedRoute(pathname)
    ) {
      router.push("/dashboard");
    }
  }, [currentPrefix, pathname, router, unlockedPrefixes]);

  const submitPassword = useCallback(
    async (password: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/developer-mode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(json.error || "Invalid password");
        }

        const target = pendingHref ?? pathname;
        const prefix = getDeveloperProtectedPrefix(target);
        if (!prefix) {
          setModalOpen(false);
          setPendingHref(null);
          return;
        }

        unlockPrefix(prefix);
        setModalOpen(false);
        setPendingHref(null);

        if (target !== pathname) {
          router.push(target);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid password");
      } finally {
        setBusy(false);
      }
    },
    [pathname, pendingHref, router, unlockPrefix],
  );

  useEffect(() => {
    if (!isDeveloperProtectedRoute(pathname)) {
      setUnlockedPrefixes((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    if (currentPrefix && !unlockedRef.current.has(currentPrefix)) {
      openModalFor(pathname);
    }
  }, [pathname, currentPrefix, openModalFor]);

  const value = useMemo<DeveloperModeContextValue>(
    () => ({
      tryNavigate,
      isProtectedRoute: isDeveloperProtectedRoute,
      isRouteUnlocked: (href: string) => {
        const prefix = getDeveloperProtectedPrefix(href);
        return prefix !== null && unlockedPrefixes.has(prefix);
      },
    }),
    [tryNavigate, unlockedPrefixes],
  );

  return (
    <DeveloperModeContext.Provider value={value}>
      {children}
      {!isCurrentRouteUnlocked && currentPrefix ? (
        <div className="fixed inset-0 z-[100] bg-background" aria-hidden />
      ) : null}
      <DeveloperModeModal
        open={modalOpen}
        busy={busy}
        error={error}
        onClose={closeModal}
        onSubmit={(password) => void submitPassword(password)}
      />
    </DeveloperModeContext.Provider>
  );
}
