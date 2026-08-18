"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Play,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TestRunTimer } from "@/components/TestRunTimer";
import {
  estimateModalTestMs,
  recordSuiteDuration,
} from "@/lib/developer-test/benchmarks";
import { DOMAIN_MIGRATION_SUITE_ID } from "@/lib/migration-test/developer-suite-meta";
import {
  buildDomainMigrationTest,
  MIGRATION_DOMAIN_STORAGE_KEY,
} from "@/lib/documentation/domain-migration-test-config";
import {
  buildMigrationDomains,
  validateMigrationDomains,
} from "@/lib/migration-test/domains";
import type { MigrationStepResult } from "@/lib/migration-test/runner";

type RunSummary = {
  results: MigrationStepResult[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  allAutomatedPassed: boolean;
};

export type MigrationTestRunSummary = RunSummary;

const PREVIEW_DOMAINS = buildMigrationDomains(
  "old-domain.example",
  "new-domain.example",
);

function useIsClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function StatusIcon({
  status,
}: {
  status: MigrationStepResult["status"] | undefined;
}) {
  if (status === "pass") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />;
  }
  if (status === "fail") {
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  }
  if (status === "skip") {
    return <AlertCircle className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <span className="inline-block size-4 shrink-0" />;
}

function loadStoredDomains(): { oldDomain: string; newDomain: string } {
  if (typeof window === "undefined") {
    return { oldDomain: "", newDomain: "" };
  }
  try {
    const raw = window.localStorage.getItem(MIGRATION_DOMAIN_STORAGE_KEY);
    if (!raw) return { oldDomain: "", newDomain: "" };
    const parsed = JSON.parse(raw) as {
      oldDomain?: string;
      newDomain?: string;
    };
    return {
      oldDomain: parsed.oldDomain ?? "",
      newDomain: parsed.newDomain ?? "",
    };
  } catch {
    return { oldDomain: "", newDomain: "" };
  }
}

export function MigrationTestModal({
  open,
  onClose,
  onComplete,
  onRunStart,
  onRunStop,
  initialSummary = null,
  resetKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  onComplete?: (summary: RunSummary, durationMs: number) => void;
  onRunStart?: () => void;
  onRunStop?: () => void;
  initialSummary?: RunSummary | null;
  resetKey?: number;
}) {
  const mounted = useIsClient();
  const fetchAbortRef = useRef<AbortController | null>(null);
  const [oldDomain, setOldDomain] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    const stored = loadStoredDomains();
    setOldDomain(stored.oldDomain);
    setNewDomain(stored.newDomain);
    setSummary(initialSummary);
    setError(null);
  }, [open, initialSummary]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, running]);

  const stopTests = useCallback(() => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    setRunning(false);
    setRunStartedAt(undefined);
    onRunStop?.();
  }, [onRunStop]);

  useEffect(() => {
    if (resetKey === 0) return;
    stopTests();
    setSummary(null);
    setError(null);
  }, [resetKey, stopTests]);

  useEffect(() => {
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, []);

  const validation = useMemo(
    () => validateMigrationDomains(oldDomain, newDomain),
    [oldDomain, newDomain],
  );

  const testConfig = useMemo(() => {
    if (validation.ok && validation.domains) {
      return buildDomainMigrationTest(validation.domains);
    }
    return buildDomainMigrationTest(PREVIEW_DOMAINS);
  }, [validation]);

  const canRun =
    validation.ok &&
    Boolean(oldDomain.trim()) &&
    Boolean(newDomain.trim()) &&
    !running;

  const estimatedMs = estimateModalTestMs("migration", 13);

  const persistDomains = useCallback((old: string, neu: string) => {
    try {
      window.localStorage.setItem(
        MIGRATION_DOMAIN_STORAGE_KEY,
        JSON.stringify({ oldDomain: old, newDomain: neu }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const runTests = useCallback(async () => {
    if (!validation.ok || !validation.domains) return;
    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;
    const startedAt = Date.now();
    setRunStartedAt(startedAt);
    setRunning(true);
    setError(null);
    setSummary(null);
    onRunStart?.();
    persistDomains(oldDomain, newDomain);
    try {
      const response = await fetch("/api/migration-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldDomain: validation.domains.oldDomain,
          newDomain: validation.domains.newDomain,
        }),
        signal: ac.signal,
      });
      const data = (await response.json()) as RunSummary & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      const durationMs = Date.now() - startedAt;
      recordSuiteDuration(DOMAIN_MIGRATION_SUITE_ID, durationMs);
      setSummary(data);
      onComplete?.(data, durationMs);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Test run failed");
    } finally {
      if (fetchAbortRef.current === ac) {
        fetchAbortRef.current = null;
      }
      setRunning(false);
      setRunStartedAt(undefined);
    }
  }, [
    validation,
    oldDomain,
    newDomain,
    persistDomains,
    onComplete,
    onRunStart,
  ]);

  if (!open || !mounted) return null;

  const resultById = new Map(summary?.results.map((r) => [r.id, r]) ?? []);
  const usingPreviewDomains = !validation.ok;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close migration test suite"
        onClick={() => !running && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="migration-test-title"
        className="relative z-10 flex h-[min(92vh,calc(100dvh-1.5rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-popover shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-primary/5 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h2
                id="migration-test-title"
                className="font-heading text-base font-semibold leading-snug"
              >
                {validation.ok && validation.domains
                  ? buildDomainMigrationTest(validation.domains).title
                  : "Domain migration verification"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Enter old and new domains, then run automated checks from the
                admin server.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3"
            onClick={onClose}
            disabled={running}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="shrink-0 space-y-3 border-b px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="migration-old-domain" className="text-xs">
                Old domain
              </Label>
              <Input
                id="migration-old-domain"
                autoComplete="off"
                placeholder="old-domain.example"
                value={oldDomain}
                onChange={(e) => setOldDomain(e.target.value)}
                className="font-mono text-xs"
                disabled={running}
              />
              {validation.errors.oldDomain ? (
                <p className="text-xs text-destructive">
                  {validation.errors.oldDomain}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Hostname only — no https://
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="migration-new-domain" className="text-xs">
                New domain
              </Label>
              <Input
                id="migration-new-domain"
                autoComplete="off"
                placeholder="new-domain.example"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="font-mono text-xs"
                disabled={running}
              />
              {validation.errors.newDomain ? (
                <p className="text-xs text-destructive">
                  {validation.errors.newDomain}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Hostname only — no https://
                </p>
              )}
            </div>
          </div>

          {summary ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                summary.failed === 0
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {summary.passed} passed · {summary.failed} failed ·{" "}
              {summary.skipped} manual
            </span>
          ) : null}

          {running ? (
            <TestRunTimer
              active
              estimatedTotalMs={estimatedMs}
              startedAt={runStartedAt}
              progressLabel="Domain migration checks"
              onStop={stopTests}
            />
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          {usingPreviewDomains ? (
            <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Test list below shows example URLs (
              <code className="font-mono">old-domain.example</code> →{" "}
              <code className="font-mono">new-domain.example</code>) until you
              enter your real domains above.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {testConfig.phases.map((phase) => (
            <div key={phase.id} className="mb-6 last:mb-0">
              <p className="mb-1 text-sm font-semibold text-foreground">
                {phase.title}
              </p>
              <p className="mb-2 text-xs leading-5 text-muted-foreground">
                {phase.description}
              </p>
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="border-b border-border/70 bg-muted/50">
                    <tr>
                      <th className="w-10 px-3 py-2 font-medium" />
                      <th className="w-12 px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Check</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase.steps.map((row) => {
                      const result = resultById.get(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b border-border/50 last:border-0",
                            result?.status === "pass" && "bg-emerald-500/5",
                            result?.status === "fail" && "bg-destructive/5",
                          )}
                        >
                          <td className="px-3 py-2 align-top">
                            <StatusIcon status={result?.status} />
                          </td>
                          <td className="px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                            {row.step}
                          </td>
                          <td className="px-3 py-2 align-top text-foreground/90">
                            <p>{row.action}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Pass if: {row.expected}
                            </p>
                          </td>
                          <td className="px-3 py-2 align-top text-xs">
                            {result ? (
                              <div>
                                <p
                                  className={cn(
                                    "font-medium",
                                    result.status === "pass" &&
                                      "text-emerald-700 dark:text-emerald-400",
                                    result.status === "fail" &&
                                      "text-destructive",
                                    result.status === "skip" &&
                                      "text-muted-foreground",
                                  )}
                                >
                                  {result.message}
                                </p>
                                {result.detail ? (
                                  <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">
                                    {result.detail}
                                  </pre>
                                ) : null}
                              </div>
                            ) : running ? (
                              <span className="text-muted-foreground">
                                Pending…
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {summary ? (
            <div
              className={cn(
                "rounded-lg border p-3",
                summary.allAutomatedPassed
                  ? "border-emerald-600/30 bg-emerald-500/5"
                  : "border-amber-600/30 bg-amber-500/5",
              )}
            >
              <p className="text-sm font-medium text-foreground">
                {summary.allAutomatedPassed
                  ? "All automated checks passed."
                  : `${summary.failed} check(s) failed — fix issues and run again.`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Steps B8 (WalletConnect UI) and B11 (TLS dashboard) are manual
                confirmations only.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {running
              ? "Test run in progress — use Stop above or wait for completion."
              : !canRun
                ? !oldDomain.trim() || !newDomain.trim()
                  ? "Enter old and new domains to enable the run."
                  : "Fix domain validation errors to enable the run."
                : "Tests use your entered domains for HTTPS, redirects, API, and CORS checks."}
          </p>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={running}>
              Close
            </Button>
            <Button onClick={() => void runTests()} disabled={!canRun}>
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {running ? "Running tests…" : "Run automated tests"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DomainMigrationTestSuite({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 border-primary/25 bg-card shadow-sm ring-1 ring-primary/10",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Full migration test suite
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Enter old and new domains plus your test secret — 13 automated
              checks run in-panel. WalletConnect (B8) and Render SSL (B11) need
              a quick manual confirm.
            </p>
          </div>
        </div>
        <Button size="lg" className="shrink-0" onClick={() => setOpen(true)}>
          <Play className="size-4" />
          Run migration test suite
        </Button>
      </div>
      <MigrationTestModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
