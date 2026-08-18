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
import { SPENDER_CHANGE_SUITE_ID } from "@/lib/spender-change-test/developer-suite-meta";
import { buildSpenderChangeTest } from "@/lib/documentation/spender-change-test-config";
import { SPENDER_CHANGE_STORAGE_KEY } from "@/lib/spender-change-test/inputs";
import {
  buildSpenderChangeInput,
  validateSpenderChangeInput,
  type SpenderChangeInput,
} from "@/lib/spender-change-test/inputs";
import type { SpenderChangeStepResult } from "@/lib/spender-change-test/runner";

type RunSummary = {
  results: SpenderChangeStepResult[];
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  allAutomatedPassed: boolean;
};

export type SpenderChangeTestRunSummary = RunSummary;

const PREVIEW_INPUT = buildSpenderChangeInput({
  oldSpenderEvm: "0x0000000000000000000000000000000000000001",
  oldSpenderTron: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
  newSpenderEvm: "0x0000000000000000000000000000000000000002",
  newSpenderTron: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeB",
  devBackendUrl: "http://127.0.0.1:4000",
});

function useIsClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function StatusIcon({
  status,
}: {
  status: SpenderChangeStepResult["status"] | undefined;
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

function loadStoredInput(): Partial<SpenderChangeInput> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SPENDER_CHANGE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<SpenderChangeInput>;
  } catch {
    return {};
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function SpenderChangeTestModal({
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
  const [form, setForm] = useState<Partial<SpenderChangeInput>>({});
  const [prodAdminApiKey, setProdAdminApiKey] = useState("");
  const [running, setRunning] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(loadStoredInput());
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

  const validation = useMemo(() => validateSpenderChangeInput(form), [form]);

  const testConfig = useMemo(() => {
    if (validation.ok && validation.input) {
      return buildSpenderChangeTest(validation.input);
    }
    return buildSpenderChangeTest(PREVIEW_INPUT);
  }, [validation]);

  const allRequiredFilled =
    Boolean(form.oldSpenderEvm?.trim()) &&
    Boolean(form.oldSpenderTron?.trim()) &&
    Boolean(form.newSpenderEvm?.trim()) &&
    Boolean(form.newSpenderTron?.trim());

  const canRun = validation.ok && allRequiredFilled && !running;

  const estimatedMs = estimateModalTestMs("spender", 26);

  const updateField = useCallback(
    <K extends keyof SpenderChangeInput>(
      key: K,
      value: SpenderChangeInput[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const persistInput = useCallback((input: Partial<SpenderChangeInput>) => {
    try {
      const toStore = { ...input };
      delete (toStore as Partial<SpenderChangeInput>).newEvmPrivateKey;
      delete (toStore as Partial<SpenderChangeInput>).newTronPrivateKey;
      window.localStorage.setItem(
        SPENDER_CHANGE_STORAGE_KEY,
        JSON.stringify(toStore),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const runTests = useCallback(async () => {
    if (!validation.ok || !validation.input) return;
    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;
    const startedAt = Date.now();
    setRunStartedAt(startedAt);
    setRunning(true);
    setError(null);
    setSummary(null);
    onRunStart?.();
    persistInput(form);
    try {
      const response = await fetch("/api/spender-change-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validation.input,
          prodAdminApiKey: prodAdminApiKey.trim() || undefined,
        }),
        signal: ac.signal,
      });
      const data = (await response.json()) as RunSummary & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }
      const durationMs = Date.now() - startedAt;
      recordSuiteDuration(SPENDER_CHANGE_SUITE_ID, durationMs);
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
  }, [validation, form, prodAdminApiKey, persistInput, onComplete, onRunStart]);

  if (!open || !mounted) return null;

  const resultById = new Map(summary?.results.map((r) => [r.id, r]) ?? []);
  const usingExampleInput = !validation.ok;
  const visiblePhases = testConfig.phases.filter((phase) => {
    if (phase.id === "phase-c" && !form.websiteUrl) return false;
    if (phase.id === "phase-d" && !form.prodBackendUrl) return false;
    return true;
  });

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close spender change test suite"
        onClick={() => !running && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="spender-change-test-title"
        className="relative z-10 flex h-[min(92vh,calc(100dvh-1.5rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-popover shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-primary/5 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h2
                id="spender-change-test-title"
                className="font-heading text-base font-semibold leading-snug"
              >
                {validation.ok && validation.input
                  ? buildSpenderChangeTest(validation.input).title
                  : "Spender rotation verification"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Enter old and new spender addresses, then run automated checks
                against dev, website, and production backends.
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-3 border-b px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spender-old-evm" className="text-xs">
                  Old EVM spender
                </Label>
                <Input
                  id="spender-old-evm"
                  autoComplete="off"
                  placeholder="0x…"
                  value={form.oldSpenderEvm ?? ""}
                  onChange={(e) => updateField("oldSpenderEvm", e.target.value)}
                  className="font-mono text-xs"
                  disabled={running}
                />
                <FieldError message={validation.errors.oldSpenderEvm} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spender-new-evm" className="text-xs">
                  New EVM spender
                </Label>
                <Input
                  id="spender-new-evm"
                  autoComplete="off"
                  placeholder="0x…"
                  value={form.newSpenderEvm ?? ""}
                  onChange={(e) => updateField("newSpenderEvm", e.target.value)}
                  className="font-mono text-xs"
                  disabled={running}
                />
                <FieldError message={validation.errors.newSpenderEvm} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spender-old-tron" className="text-xs">
                  Old TRON spender
                </Label>
                <Input
                  id="spender-old-tron"
                  autoComplete="off"
                  placeholder="T…"
                  value={form.oldSpenderTron ?? ""}
                  onChange={(e) =>
                    updateField("oldSpenderTron", e.target.value)
                  }
                  className="font-mono text-xs"
                  disabled={running}
                />
                <FieldError message={validation.errors.oldSpenderTron} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spender-new-tron" className="text-xs">
                  New TRON spender
                </Label>
                <Input
                  id="spender-new-tron"
                  autoComplete="off"
                  placeholder="T…"
                  value={form.newSpenderTron ?? ""}
                  onChange={(e) =>
                    updateField("newSpenderTron", e.target.value)
                  }
                  className="font-mono text-xs"
                  disabled={running}
                />
                <FieldError message={validation.errors.newSpenderTron} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spender-new-evm-key" className="text-xs">
                  New ADMIN_EVM_PRIVATE_KEY (optional)
                </Label>
                <Input
                  id="spender-new-evm-key"
                  type="password"
                  autoComplete="off"
                  placeholder="0x… or hex key"
                  value={form.newEvmPrivateKey ?? ""}
                  onChange={(e) =>
                    updateField("newEvmPrivateKey", e.target.value)
                  }
                  className="font-mono text-xs"
                  disabled={running}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spender-new-tron-key" className="text-xs">
                  New ADMIN_TRON_PRIVATE_KEY (optional)
                </Label>
                <Input
                  id="spender-new-tron-key"
                  type="password"
                  autoComplete="off"
                  placeholder="64-char hex"
                  value={form.newTronPrivateKey ?? ""}
                  onChange={(e) =>
                    updateField("newTronPrivateKey", e.target.value)
                  }
                  className="font-mono text-xs"
                  disabled={running}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spender-dev-backend" className="text-xs">
                  Dev backend URL
                </Label>
                <Input
                  id="spender-dev-backend"
                  autoComplete="off"
                  placeholder="http://127.0.0.1:4000"
                  value={form.devBackendUrl ?? "http://127.0.0.1:4000"}
                  onChange={(e) => updateField("devBackendUrl", e.target.value)}
                  className="font-mono text-xs"
                  disabled={running}
                />
                <FieldError message={validation.errors.devBackendUrl} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spender-website" className="text-xs">
                  Website URL (optional)
                </Label>
                <Input
                  id="spender-website"
                  autoComplete="off"
                  placeholder="http://localhost:3000"
                  value={form.websiteUrl ?? ""}
                  onChange={(e) => updateField("websiteUrl", e.target.value)}
                  className="font-mono text-xs"
                  disabled={running}
                />
                <FieldError message={validation.errors.websiteUrl} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="spender-prod-backend" className="text-xs">
                  Production backend URL (optional)
                </Label>
                <Input
                  id="spender-prod-backend"
                  autoComplete="off"
                  placeholder="https://api.example.com"
                  value={form.prodBackendUrl ?? ""}
                  onChange={(e) =>
                    updateField("prodBackendUrl", e.target.value)
                  }
                  className="font-mono text-xs"
                  disabled={running}
                />
                <FieldError message={validation.errors.prodBackendUrl} />
              </div>
            </div>

            {form.prodBackendUrl ? (
              <div className="space-y-2">
                <Label htmlFor="spender-prod-key" className="text-xs">
                  Production backend admin key (optional — uses
                  PRODUCTION_ADMIN_API_KEY from server env if empty)
                </Label>
                <Input
                  id="spender-prod-key"
                  type="password"
                  autoComplete="off"
                  value={prodAdminApiKey}
                  onChange={(e) => setProdAdminApiKey(e.target.value)}
                  className="font-mono text-xs"
                  disabled={running}
                />
              </div>
            ) : null}

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
                progressLabel="Spender rotation checks"
                onStop={stopTests}
              />
            ) : null}

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            {usingExampleInput ? (
              <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Test list below shows example values until you enter real
                old/new spender addresses above.
              </p>
            ) : null}
          </div>

          <div className="px-4 py-4">
            {visiblePhases.map((phase) => (
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
                  Phase G (env files, Render, funding, connect flow) requires
                  manual confirmation.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {running
              ? "Test run in progress — use Stop above or wait for completion."
              : !canRun
                ? !allRequiredFilled
                  ? "Enter all four spender addresses (old and new EVM + TRON) to enable the run."
                  : "Fix address validation errors to enable the run."
                : "Private keys are used only for derivation during this test — not stored. Dev uses ADMIN_API_KEY from server env."}
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

export function SpenderChangeTestSuite({ className }: { className?: string }) {
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
              Full spender rotation test suite
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Enter old and new spender addresses plus optional backend URLs —
              checks public config, system status, and stale-address detection.
            </p>
          </div>
        </div>
        <Button size="lg" className="shrink-0" onClick={() => setOpen(true)}>
          <Play className="size-4" />
          Run spender change test suite
        </Button>
      </div>
      <SpenderChangeTestModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
