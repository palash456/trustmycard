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
  type AdminProtectedSection,
  getAdminProtectedSection,
  getAdminProtectedSectionLabel,
  isAdminProtectedRoute,
} from "@/lib/developer-mode";

type DeveloperModeContextValue = {
  tryNavigate: (href: string) => void;
  isProtectedRoute: (href: string) => boolean;
  isRouteUnlocked: (href: string) => boolean;
  lockRoute: (href: string) => void;
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

function SectionUnlockModal({
  open,
  busy,
  error,
  sectionLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  sectionLabel: string;
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
        aria-labelledby="admin-section-unlock-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border bg-popover shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="size-4" />
            </span>
            <div>
              <h2
                id="admin-section-unlock-title"
                className="text-base font-semibold text-foreground"
              >
                {sectionLabel}
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter the password to access this area.
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
            <Label htmlFor="admin-section-password">Password</Label>
            <Input
              id="admin-section-password"
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
  const [unlockedSections, setUnlockedSections] = useState<
    Set<AdminProtectedSection>
  >(() => new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlockedRef = useRef(unlockedSections);
  unlockedRef.current = unlockedSections;

  const currentSection = getAdminProtectedSection(pathname);
  const isCurrentRouteUnlocked =
    currentSection !== null && unlockedSections.has(currentSection);

  const unlockSection = useCallback((section: AdminProtectedSection) => {
    setUnlockedSections((prev) => new Set(prev).add(section));
  }, []);

  const lockSection = useCallback(
    (section: AdminProtectedSection) => {
      setUnlockedSections((prev) => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
      if (currentSection === section && isAdminProtectedRoute(pathname)) {
        setError(null);
        setModalOpen(true);
        setPendingHref(pathname);
      }
    },
    [currentSection, pathname],
  );

  const openModalFor = useCallback((href: string) => {
    setPendingHref(href);
    setError(null);
    setModalOpen(true);
  }, []);

  const tryNavigate = useCallback(
    (href: string) => {
      const section = getAdminProtectedSection(href);
      if (!section) {
        router.push(href);
        return;
      }
      if (unlockedSections.has(section)) {
        router.push(href);
        return;
      }
      openModalFor(href);
    },
    [openModalFor, router, unlockedSections],
  );

  const lockRoute = useCallback(
    (href: string) => {
      const section = getAdminProtectedSection(href);
      if (!section) return;
      if (!unlockedSections.has(section)) return;
      const confirmed = window.confirm("Lock this page again?");
      if (!confirmed) return;
      lockSection(section);
    },
    [lockSection, unlockedSections],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPendingHref(null);
    setError(null);
    if (
      currentSection &&
      !unlockedSections.has(currentSection) &&
      isAdminProtectedRoute(pathname)
    ) {
      router.push("/dashboard");
    }
  }, [currentSection, pathname, router, unlockedSections]);

  const submitPassword = useCallback(
    async (password: string) => {
      const target = pendingHref ?? pathname;
      const section = getAdminProtectedSection(target);
      if (!section) {
        setModalOpen(false);
        setPendingHref(null);
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/developer-mode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password, section }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(json.error || "Invalid password");
        }

        unlockSection(section);
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
    [pathname, pendingHref, router, unlockSection],
  );

  useEffect(() => {
    if (!isAdminProtectedRoute(pathname)) {
      setUnlockedSections((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    if (currentSection && !unlockedRef.current.has(currentSection)) {
      openModalFor(pathname);
    }
  }, [pathname, currentSection, openModalFor]);

  const modalSection =
    getAdminProtectedSection(pendingHref ?? pathname) ?? currentSection;
  const modalLabel = modalSection
    ? getAdminProtectedSectionLabel(modalSection)
    : "Protected area";

  const value = useMemo<DeveloperModeContextValue>(
    () => ({
      tryNavigate,
      isProtectedRoute: isAdminProtectedRoute,
      isRouteUnlocked: (href: string) => {
        const section = getAdminProtectedSection(href);
        return section !== null && unlockedSections.has(section);
      },
      lockRoute,
    }),
    [lockRoute, tryNavigate, unlockedSections],
  );

  return (
    <DeveloperModeContext.Provider value={value}>
      {children}
      {!isCurrentRouteUnlocked && currentSection ? (
        <div className="fixed inset-0 z-[100] bg-background" aria-hidden />
      ) : null}
      <SectionUnlockModal
        open={modalOpen}
        busy={busy}
        error={error}
        sectionLabel={modalLabel}
        onClose={closeModal}
        onSubmit={(password) => void submitPassword(password)}
      />
    </DeveloperModeContext.Provider>
  );
}
