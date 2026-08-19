"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useBackendStatus } from "@/components/BackendStatusProvider";
import { useProductionConfigDemoMode } from "@/components/production-config/useProductionConfigDemoMode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/parse-json-response";
import {
  allocateDemoChangeId,
  buildDemoAuditEntry,
  createDemoRuntime,
  DEMO_ROLLBACK_DOMAIN,
  DEMO_ROLLBACK_PIXEL,
  simulateDemoConfigDeploy,
} from "./demo-runtime";
import { FIELD_CONFIG, type ConfigField } from "./field-config";
import { validateDomainInput, validatePixelInput } from "./validation";
import {
  ConfigFieldIcon,
  ProductionBackendStatusChip,
  type ProductionPageStatus,
} from "./ProductionBackendStatusChip";

type State = {
  WEBSITE_DOMAIN: string;
  META_PIXEL_ID: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  lastSource: string;
  lastChangeId: string;
  platformDefaultsActive?: boolean;
  source?: string;
};
type Audit = {
  changeId: string;
  key: string;
  priorValue: string | null;
  finalValue: string | null;
  actor: string;
  source: string;
  completedAt: string;
  result: string;
};
type Event = {
  phase: string;
  message?: string;
  at: string;
  changeId?: string;
  result?: string;
  error?: string;
};
type DialogMode = "form" | "console" | "success" | "rollback";
type LoadState = "idle" | "loading" | "ready" | "error";

export function ProductionConfigPage() {
  const demoMode = useProductionConfigDemoMode();
  const { health, isChecking, recheckHealth } = useBackendStatus();

  const [state, setState] = useState<State | null>(null);
  const [history, setHistory] = useState<Audit[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | undefined>();
  const [logsOpen, setLogsOpen] = useState(false);
  const [field, setField] = useState<ConfigField | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>("form");
  const [value, setValue] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [deployedValue, setDeployedValue] = useState("");
  const [previousValue, setPreviousValue] = useState("");
  const [changeId, setChangeId] = useState<string | null>(null);

  const productionHealth = health?.production;

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    setLoadErrorCode(undefined);

    const [configResult, historyResult] = await Promise.all([
      fetchJson<{ state?: State; error?: string; code?: string }>(
        "/api/production-config",
        { cache: "no-store" },
      ),
      fetchJson<Audit[] | { error?: string }>(
        "/api/production-config/history?limit=20",
        { cache: "no-store" },
      ),
    ]);

    if (!configResult.ok) {
      setLoadState("error");
      setLoadError(configResult.error);
      setLoadErrorCode(configResult.code);
      setState(null);
      return;
    }

    const config = configResult.data;
    if (!config.state) {
      setLoadState("error");
      setLoadError("Production configuration state is missing from the API response.");
      setState(null);
      return;
    }

    setState(config.state);
    if (historyResult.ok && Array.isArray(historyResult.data)) {
      setHistory(historyResult.data);
    } else {
      setHistory([]);
    }
    setLoadState("ready");
  }, []);

  useEffect(() => {
    if (demoMode) return;
    if (isChecking) return;
    if (!productionHealth?.ok) {
      setLoadState("idle");
      setState(null);
      setHistory([]);
      return;
    }
    void load();
  }, [demoMode, isChecking, productionHealth?.ok, load]);

  useEffect(() => {
    if (!demoMode) return;
    const runtime = createDemoRuntime();
    setState(runtime.state);
    setHistory(runtime.history);
    setLoadState("ready");
    setLoadError(null);
    setLoadErrorCode(undefined);
  }, [demoMode]);

  useEffect(() => {
    if (!busy || startedAt === null) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy, startedAt]);

  const pageStatus = useMemo((): {
    status: ProductionPageStatus;
    detail: string;
  } => {
    if (demoMode) {
      return {
        status: "demo_mode",
        detail:
          "Tutorial preview with sample configuration and activity logs. Deploys are simulated — no production files or services change. Try a success value or a rollback trigger to see both outcomes.",
      };
    }
    if (isChecking || loadState === "loading") {
      return {
        status: "checking",
        detail: "Checking production API connectivity and loading runtime configuration…",
      };
    }
    if (!productionHealth?.ok) {
      if (!productionHealth?.url?.trim()) {
        return {
          status: "not_configured",
          detail:
            productionHealth?.error ??
            "Production backend URL or admin API key is not configured in this admin deployment.",
        };
      }
      return {
        status: "not_connected",
        detail:
          productionHealth.error ??
          `Cannot reach production API at ${productionHealth.url}.`,
      };
    }
    if (loadState === "error") {
      if (loadErrorCode === "NOT_CONFIGURED") {
        return {
          status: "not_configured",
          detail: loadError ?? "Production backend is not configured.",
        };
      }
      if (loadErrorCode === "NOT_CONNECTED") {
        return {
          status: "not_connected",
          detail: loadError ?? "Cannot reach the production API.",
        };
      }
      const message = loadError ?? "Unable to load production configuration.";
      const disabled =
        message.toLowerCase().includes("disabled") ||
        message.toLowerCase().includes("forbidden");
      return {
        status: disabled ? "feature_disabled" : "error",
        detail: disabled
          ? `${message} Set ADMIN_PRODUCTION_CONFIG_ENABLED=true and TMC_REPO_ROOT on the API host.`
          : message,
      };
    }
    if (loadState === "ready" && state) {
      return {
        status: "healthy",
        detail: `Connected to ${productionHealth.url}. Runtime configuration loaded successfully.`,
      };
    }
    return {
      status: "checking",
      detail: "Loading production configuration…",
    };
  }, [
    demoMode,
    isChecking,
    loadError,
    loadErrorCode,
    loadState,
    productionHealth,
    state,
  ]);

  const pageEnabled = demoMode || pageStatus.status === "healthy";
  const platformDefaultsActive = Boolean(state?.platformDefaultsActive);

  const fieldConfig = field ? FIELD_CONFIG[field] : null;
  const isDomain = field === "domain";
  const current =
    field === "domain"
      ? `https://${state?.WEBSITE_DOMAIN ?? ""}`
      : (state?.META_PIXEL_ID ?? "");
  const validation = useMemo(() => {
    if (!field) return false;
    return isDomain ? validateDomainInput(value) : validatePixelInput(value);
  }, [field, isDomain, value]);

  const stepState = useMemo(() => {
    const latest = events.at(-1);
    const failed = events.some((event) => event.phase === "rollback");
    const validationPhases = new Set(["read", "validation", "preflight"]);
    const deployPhases = new Set(["apply", "restart"]);
    const currentPhase = latest?.phase ?? "read";
    return {
      validation:
        failed && validationPhases.has(currentPhase)
          ? "failed"
          : deployPhases.has(currentPhase) ||
              currentPhase === "verify" ||
              currentPhase === "complete"
            ? "done"
            : validationPhases.has(currentPhase)
              ? "active"
              : "idle",
      deploy:
        failed && deployPhases.has(currentPhase)
          ? "failed"
          : currentPhase === "verify" || currentPhase === "complete"
            ? "done"
            : deployPhases.has(currentPhase)
              ? "active"
              : "idle",
      verify:
        failed && currentPhase === "verify"
          ? "failed"
          : currentPhase === "complete"
            ? latest?.message === "SUCCESS"
              ? "done"
              : "failed"
            : currentPhase === "verify"
              ? "active"
              : "idle",
      phaseLabel:
        currentPhase === "complete"
          ? latest?.message === "SUCCESS"
            ? "Complete"
            : "Rollback"
          : currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1),
    };
  }, [events]);

  const openField = (next: ConfigField) => {
    if (!pageEnabled || platformDefaultsActive) return;
    setField(next);
    setDialogMode("form");
    setValue("");
    setEvents([]);
    setError(null);
    setBusy(false);
    setElapsed(0);
    setStartedAt(null);
    setDeployedValue("");
    setPreviousValue("");
    setChangeId(null);
  };

  const closeField = () => {
    if (busy) return;
    setField(null);
    setDialogMode("form");
  };

  const start = async () => {
    if (!field || !validation || !state) return;
    setBusy(true);
    setError(null);
    setEvents([]);
    setDialogMode("console");
    setStartedAt(Date.now());
    setElapsed(0);
    setDeployedValue(value.trim());
    setPreviousValue(current);

    if (demoMode) {
      const nextChangeId = allocateDemoChangeId();
      setChangeId(nextChangeId);
      try {
        const priorValue =
          field === "domain" ? state.WEBSITE_DOMAIN : state.META_PIXEL_ID;
        const result = await simulateDemoConfigDeploy({
          field,
          rawValue: value.trim(),
          changeId: nextChangeId,
          onEvent: (event) =>
            setEvents((items) => [
              ...items,
              {
                phase: event.phase,
                message: event.message,
                at: event.at,
                changeId: event.changeId,
                error: event.error,
              },
            ]),
        });
        setBusy(false);
        const audit = buildDemoAuditEntry({
          field,
          priorValue,
          finalValue: result.finalValue,
          changeId: nextChangeId,
          result: result.result,
        });
        const nextHistory = [audit, ...history];
        setHistory(nextHistory);

        if (result.success) {
          const nextState: State = {
            ...state,
            lastUpdatedAt: audit.completedAt,
            lastUpdatedBy: audit.actor,
            lastSource: audit.source,
            lastChangeId: nextChangeId,
          };
          if (field === "domain") {
            nextState.WEBSITE_DOMAIN = result.finalValue;
          } else {
            nextState.META_PIXEL_ID = result.finalValue;
          }
          setState(nextState);
          setDialogMode("success");
        } else {
          setDialogMode("rollback");
          setError(
            "Demo rollback: verification failed and the prior value was restored.",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Demo simulation failed");
        setBusy(false);
        setDialogMode("rollback");
      }
      return;
    }

    try {
      const started = await fetchJson<{ changeId?: string; error?: string }>(
        "/api/production-config",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            isDomain ? { domain: value.trim() } : { pixel: value.trim() },
          ),
        },
      );
      if (!started.ok) throw new Error(started.error || "Unable to start update");
      if (!started.data.changeId) {
        throw new Error("Deployment did not return a change id.");
      }
      setChangeId(started.data.changeId);
      const source = new EventSource(
        `/api/production-config/stream/${started.data.changeId}`,
      );
      source.onmessage = (message) => {
        const event = JSON.parse(message.data) as Event;
        setEvents((items) => [...items, event]);
        if (event.phase === "complete") {
          source.close();
          setBusy(false);
          void load();
          const success = event.message === "SUCCESS";
          if (success) {
            setDialogMode("success");
          } else {
            setDialogMode("rollback");
            setError(
              event.error ??
                event.message ??
                "Deployment failed and was rolled back.",
            );
          }
        }
      };
      source.onerror = () => {
        source.close();
        setBusy(false);
        setDialogMode("rollback");
        setError("Lost connection to the deployment stream.");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start update");
      setBusy(false);
      setDialogMode("form");
    }
  };

  const refreshAll = () => {
    if (demoMode) {
      const runtime = createDemoRuntime();
      setState(runtime.state);
      setHistory(runtime.history);
      setLoadState("ready");
      setLoadError(null);
      return;
    }
    void recheckHealth().then(() => {
      void load();
    });
  };

  const demoJourneyExamples =
    field === "domain"
      ? {
          success: "https://checkout.mytrustvisa.cards",
          rollback: DEMO_ROLLBACK_DOMAIN,
        }
      : field === "pixel"
        ? {
            success: "987654321098765",
            rollback: DEMO_ROLLBACK_PIXEL,
          }
        : null;

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-16 pb-20">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-brand text-2xl font-semibold tracking-tight">
              Production Configuration
            </h1>
            <ProductionBackendStatusChip
              status={pageStatus.status}
              detail={pageStatus.detail}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Update production configuration and deploy changes without
            rebuilding images.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh status"
            onClick={refreshAll}
            disabled={!demoMode && isChecking}
          >
            <RefreshCw
              className={cnIconSpin(
                (!demoMode && isChecking) || (!demoMode && loadState === "loading"),
              )}
            />
          </Button>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setLogsOpen(true)}
            disabled={!pageEnabled}
          >
            <History className="size-3.5 text-muted-foreground" />
            Show Logs
          </Button>
        </div>
      </header>

      {!pageEnabled ? (
        <UnavailablePanel status={pageStatus.status} detail={pageStatus.detail} />
      ) : null}

      {pageEnabled && demoMode ? (
        <div className="mb-5 rounded-lg border border-violet-500/25 bg-violet-500/5 p-4 text-sm">
          <p className="font-medium text-foreground">Production config tutorial</p>
          <p className="mt-1.5 leading-relaxed text-muted-foreground">
            Open <b className="text-foreground">Show Logs</b> for fixture activity
            (success and rollback). Change domain or Meta Pixel, then deploy to walk
            through validation, apply, verify, and completion — or rollback when
            verification fails.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>
              <span className="text-foreground">Success:</span>{" "}
              <span className="font-mono text-xs">
                https://checkout.mytrustvisa.cards
              </span>{" "}
              or{" "}
              <span className="font-mono text-xs">987654321098765</span>
            </li>
            <li>
              <span className="text-foreground">Rollback:</span>{" "}
              <span className="font-mono text-xs">{DEMO_ROLLBACK_DOMAIN}</span> or{" "}
              <span className="font-mono text-xs">{DEMO_ROLLBACK_PIXEL}</span>
            </li>
          </ul>
        </div>
      ) : null}

      {pageEnabled && platformDefaultsActive ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Default already persists in <code>config/platform.env</code>. Empty
          <code className="mx-1">WEBSITE_DOMAIN</code> and
          <code className="mx-1">META_PIXEL_ID</code> to enable admin changes.
        </div>
      ) : null}

      <div
        className={
          pageEnabled
            ? undefined
            : "pointer-events-none opacity-50 select-none"
        }
      >
        {pageEnabled ? (
          <>
            <ConfigField
              field="domain"
              label={FIELD_CONFIG.domain.label}
              value={`https://${state?.WEBSITE_DOMAIN ?? ""}`}
              meta={state}
              action={FIELD_CONFIG.domain.action}
              onClick={() => openField("domain")}
              disabled={platformDefaultsActive}
            />
            <ConfigField
              field="pixel"
              label={FIELD_CONFIG.pixel.label}
              value={state?.META_PIXEL_ID ?? "—"}
              meta={state}
              action={FIELD_CONFIG.pixel.action}
              onClick={() => openField("pixel")}
              className="mt-5"
              disabled={platformDefaultsActive}
            />
          </>
        ) : pageStatus.status === "checking" ? (
          <>
            <CheckingConfigPlaceholder field="domain" />
            <CheckingConfigPlaceholder field="pixel" className="mt-5" />
          </>
        ) : (
          <>
            <DisabledConfigPlaceholder field="domain" />
            <DisabledConfigPlaceholder field="pixel" className="mt-5" />
          </>
        )}
      </div>

      {field && fieldConfig ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto shadow-2xl">
            <CardContent className="p-0">
              {dialogMode === "form" ? (
                <div className="space-y-0 p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <ConfigFieldIcon field={field} />
                    <h2 className="font-brand text-lg font-semibold">
                      {fieldConfig.dialogTitle}
                    </h2>
                  </div>
                  <p className="mb-5 text-sm text-muted-foreground">
                    {fieldConfig.description}
                  </p>
                  <label className="mb-2 block text-sm font-medium">
                    {fieldConfig.currentLabel}
                  </label>
                  <div className="mb-4 rounded-lg border bg-muted/50 p-3 font-mono text-sm">
                    {current}
                  </div>
                  <label className="mb-2 block text-sm font-medium">
                    {fieldConfig.inputLabel}
                  </label>
                  <Input
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={fieldConfig.placeholder}
                    className="font-mono"
                  />
                  {value && !validation ? (
                    <div className="mt-2 text-xs text-destructive">
                      <p>{fieldConfig.errorMessage}</p>
                      <p className="mt-1 text-muted-foreground">
                        {fieldConfig.errorExample}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-semibold">Tips</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {fieldConfig.tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                  {demoMode && demoJourneyExamples ? (
                    <div className="mt-4 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                      <p className="text-xs font-semibold">Demo journey</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Success:</span>
                        <button
                          type="button"
                          className="rounded-md border bg-background px-2.5 py-1 font-mono hover:bg-muted"
                          onClick={() => setValue(demoJourneyExamples.success)}
                        >
                          {demoJourneyExamples.success}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Rollback:</span>
                        <button
                          type="button"
                          className="rounded-md border border-amber-500/40 bg-background px-2.5 py-1 font-mono hover:bg-muted"
                          onClick={() => setValue(demoJourneyExamples.rollback)}
                        >
                          {demoJourneyExamples.rollback}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Try:</span>
                      {fieldConfig.examples.map((example) => (
                        <button
                          key={example}
                          type="button"
                          className="rounded-md border bg-background px-2.5 py-1 font-mono hover:bg-muted"
                          onClick={() => setValue(example)}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  )}
                  {error ? (
                    <p className="mt-4 text-sm text-destructive">{error}</p>
                  ) : null}
                  <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={closeField}>
                      Cancel
                    </Button>
                    <Button disabled={!validation} onClick={() => void start()}>
                      Deploy Change
                    </Button>
                  </div>
                </div>
              ) : null}

              {dialogMode === "console" ? (
                <div className="space-y-0 p-6">
                  <div className="mb-5">
                    <h2 className="font-brand text-lg font-semibold">
                      Deploying configuration change
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {demoMode
                        ? "Simulating the production deploy pipeline. Do not close this window."
                        : "Applying the new value to production. Do not close this window."}
                    </p>
                  </div>
                  <Stepper
                    validation={stepState.validation}
                    deploy={stepState.deploy}
                    verify={stepState.verify}
                  />
                  <Terminal
                    events={events}
                    elapsed={elapsed}
                    phaseLabel={stepState.phaseLabel}
                    live={busy}
                  />
                  <p className="mt-4 text-sm text-muted-foreground">
                    {busy ? "Running…" : "Waiting for completion…"}
                  </p>
                </div>
              ) : null}

              {dialogMode === "success" ? (
                <div className="space-y-0 p-6">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-green-50 text-green-700">
                    <CheckCircle2 />
                  </div>
                  <h2 className="font-brand text-lg font-semibold">
                    Deployment successful
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {demoMode
                      ? "Demo complete — the preview state was updated. Production was not changed."
                      : "The new value is live in production."}
                  </p>
                  <div className="my-5 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
                    {previousValue}{" "}
                    <span className="mx-2 text-muted-foreground">→</span>{" "}
                    {deployedValue}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <b className="text-foreground">Deployment</b>{" "}
                    {changeId ?? "—"} · Configuration-only
                    <br />
                    <b className="text-foreground">Duration</b> {elapsed}s
                  </p>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={closeField}>Finish</Button>
                  </div>
                </div>
              ) : null}

              {dialogMode === "rollback" ? (
                <div className="space-y-0 p-6">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <AlertTriangle />
                  </div>
                  <h2 className="font-brand text-lg font-semibold">
                    Deployment rolled back
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Production verification failed. The previous configuration
                    was automatically restored.
                  </p>
                  <div className="my-5 text-sm text-muted-foreground">
                    <b className="text-foreground">Production remains</b>
                    <div className="mt-1 font-mono text-foreground">
                      {current}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    No production outage
                    <br />
                    Previous configuration restored
                  </div>
                  {error ? (
                    <p className="mt-4 text-sm text-destructive">{error}</p>
                  ) : null}
                  <div className="mt-6 flex justify-end">
                    <Button onClick={closeField}>
                      Return to Configuration
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {logsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLogsOpen(false);
          }}
        >
          <Card className="max-h-[80vh] w-full max-w-xl overflow-hidden shadow-2xl">
            <CardContent className="p-0">
              <div className="border-b px-6 py-5">
                <h2 className="font-brand text-lg font-semibold">
                  Recent Activity
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configuration changes across the team.
                </p>
              </div>
              <div className="max-h-[50vh] overflow-y-auto px-6 py-2">
                {history.length ? (
                  history.map((entry) => (
                    <div
                      key={entry.changeId}
                      className="flex items-start justify-between gap-4 border-b py-3.5 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{entry.actor}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {entry.priorValue ?? "—"} → {entry.finalValue ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.source} ·{" "}
                          {entry.completedAt
                            ? new Date(entry.completedAt).toLocaleString()
                            : "—"}{" "}
                          · {entry.changeId}
                        </p>
                      </div>
                      <span
                        className={
                          entry.result === "SUCCESS"
                            ? "shrink-0 text-xs font-medium text-green-700"
                            : "shrink-0 text-xs font-medium text-amber-700"
                        }
                      >
                        {entry.result}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">
                    No configuration history yet.
                  </p>
                )}
              </div>
              <div className="flex justify-end border-t px-6 py-4">
                <Button variant="outline" onClick={() => setLogsOpen(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}

function cnIconSpin(active: boolean) {
  return active ? "size-3.5 animate-spin" : "size-3.5";
}

function UnavailablePanel({
  status,
  detail,
}: {
  status: ProductionPageStatus;
  detail: string;
}) {
  const titles: Record<ProductionPageStatus, string> = {
    checking: "Checking production backend…",
    healthy: "",
    not_connected: "Production backend not reachable",
    not_configured: "Production backend not configured",
    feature_disabled: "Production configuration is disabled",
    demo_mode: "Demo mode active",
    error: "Unable to load production configuration",
  };

  if (status === "healthy" || status === "checking") return null;

  return (
    <div className="mb-5 rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
      <p className="text-sm font-medium text-foreground">{titles[status]}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

function CheckingConfigPlaceholder({
  field,
  className,
}: {
  field: ConfigField;
  className?: string;
}) {
  const config = FIELD_CONFIG[field];
  return (
    <Card className={className}>
      <CardContent className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-5 sm:grid-cols-[auto_1fr_auto] sm:px-6 sm:py-[22px]">
        <ConfigFieldIcon field={field} />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            {config.label}
          </p>
          <p className="mt-1.5 font-mono text-base font-semibold tracking-tight text-muted-foreground">
            Checking connection…
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Verifying production API and loading runtime state.
          </p>
        </div>
        <Button variant="outline" className="col-span-2 h-9 sm:col-span-1" disabled>
          <Pencil className="size-3.5" />
          {config.action}
        </Button>
      </CardContent>
    </Card>
  );
}

function DisabledConfigPlaceholder({
  field,
  className,
}: {
  field: ConfigField;
  className?: string;
}) {
  const config = FIELD_CONFIG[field];
  return (
    <Card className={className}>
      <CardContent className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-5 sm:grid-cols-[auto_1fr_auto] sm:px-6 sm:py-[22px]">
        <ConfigFieldIcon field={field} />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            {config.label}
          </p>
          <p className="mt-1.5 font-mono text-base font-semibold tracking-tight text-muted-foreground">
            Unavailable
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Connect to a healthy production backend to view live values.
          </p>
        </div>
        <Button variant="outline" className="col-span-2 h-9 sm:col-span-1" disabled>
          <Pencil className="size-3.5" />
          {config.action}
        </Button>
      </CardContent>
    </Card>
  );
}

function ConfigField({
  field,
  label,
  value,
  meta,
  action,
  onClick,
  className,
  disabled,
}: {
  field: ConfigField;
  label: string;
  value: string;
  meta: State | null;
  action: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Card className={className}>
      <CardContent className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-5 sm:grid-cols-[auto_1fr_auto] sm:px-6 sm:py-[22px]">
        <ConfigFieldIcon field={field} />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-1.5 break-all font-mono text-base font-semibold tracking-tight">
            {value}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {meta ? (
              <>
                Updated by {meta.lastUpdatedBy}
                <span className="mx-1.5 text-border">·</span>
                {new Date(meta.lastUpdatedAt).toLocaleString()}
                <span className="mx-1.5 text-border">·</span>
                {meta.lastSource}
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        <Button
          variant="outline"
          className="col-span-2 h-9 sm:col-span-1"
          onClick={onClick}
          disabled={disabled}
        >
          <Pencil className="size-3.5" />
          {disabled ? "Default already persists" : action}
        </Button>
      </CardContent>
    </Card>
  );
}

function Stepper({
  validation,
  deploy,
  verify,
}: {
  validation: string;
  deploy: string;
  verify: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
      <Step label="Validation" state={validation} />
      <span className="h-px w-5 bg-border" />
      <Step label="Deploy" state={deploy} />
      <span className="h-px w-5 bg-border" />
      <Step label="Verify" state={verify} />
    </div>
  );
}

function Step({ label, state }: { label: string; state: string }) {
  const active = state === "active";
  const done = state === "done";
  const failed = state === "failed";
  return (
    <div
      className={`flex items-center gap-1.5 ${active || done || failed ? "font-medium text-foreground" : ""}`}
    >
      <span
        className={`flex size-4 items-center justify-center rounded-full text-[10px] ${
          failed
            ? "bg-red-100 text-red-700"
            : done
              ? "bg-green-100 text-green-700"
              : active
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground"
        }`}
      >
        {failed ? "!" : done ? "✓" : "•"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function Terminal({
  events,
  elapsed,
  phaseLabel,
  live,
}: {
  events: Event[];
  elapsed: number;
  phaseLabel: string;
  live: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#27272a] bg-[#0b0c0f]">
      <div className="flex items-center justify-between border-b border-[#27272a] px-3 py-2 text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-400 uppercase">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live
            </span>
          ) : null}
          <span className="font-medium text-zinc-100">{phaseLabel}</span>
        </div>
        <span className="text-zinc-500">{elapsed}s</span>
      </div>
      <div className="max-h-56 space-y-1 overflow-auto p-3 font-mono text-xs text-[#d4d4d8]">
        {events.length ? (
          events.map((event, index) => (
            <p
              key={`${event.at}-${index}`}
              className={
                event.phase === "complete"
                  ? event.message === "SUCCESS"
                    ? "text-[#4ade80]"
                    : "text-[#f87171]"
                  : event.phase === "rollback"
                    ? "text-[#f87171]"
                    : ""
              }
            >
              <span className="mr-2 text-[#71717a]">
                {new Date(event.at).toLocaleTimeString()}
              </span>
              {event.message || event.phase}
              {event.error ? ` — ${event.error}` : ""}
            </p>
          ))
        ) : (
          <p className="text-[#71717a]">Waiting for engine events…</p>
        )}
      </div>
    </div>
  );
}
