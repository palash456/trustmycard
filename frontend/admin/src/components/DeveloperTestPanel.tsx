"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Copy,
  Check,
  X,
  XCircle,
} from "lucide-react";
import { useDemo } from "@/components/DemoProvider";
import { InfoTip } from "@/components/InfoTip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type TestCaseMeta = {
  name: string;
  friendlyName: string;
  kind: "test" | "describe";
};

export type TestSuiteMeta = {
  id: string;
  packageId: string;
  packageName: string;
  packageDisplayName: string;
  file: string;
  fileName: string;
  friendlyTitle: string;
  area: string;
  areaLabel: string;
  layer: string;
  layerLabel: string;
  inDefaultScript: boolean;
  isFeatured: boolean;
  isEndToEnd: boolean;
  journeyStart: string;
  journeyEnd: string;
  description: string;
  purpose: string;
  expectedResult: string;
  why: string;
  cases: TestCaseMeta[];
  caseCount: number;
};

export type TestPackageMeta = {
  id: string;
  name: string;
  displayName: string;
  cwd: string;
  suites: TestSuiteMeta[];
};

export type DeveloperTestsCatalog = {
  enabled: boolean;
  packages: TestPackageMeta[];
  featuredSuites: TestSuiteMeta[];
  summary: {
    totalSuites: number;
    totalCases: number;
    byArea: Record<string, number>;
    byLayer: Record<string, number>;
  };
};

type TestRunCaseResult = {
  name: string;
  status: "pass" | "fail" | "skip";
  error?: string;
};

type TestRunResult = {
  suiteId: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  report: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    cases: TestRunCaseResult[];
  };
  connectFlowSummary?: {
    platformEnvSource: string;
    spenderEvm: string | null;
    spenderTron: string | null;
    enabledNetworks: string[];
    testUserEvm: string | null;
    testUserTron: string | null;
    collectorTransferCount: number;
    summary: string;
  };
};

type SuiteRunState = {
  status: "idle" | "running" | "pass" | "fail";
  result?: TestRunResult;
};

type ReportModal = {
  suite: TestSuiteMeta;
  result: TestRunResult;
};

function layerBadgeVariant(layer: string): "default" | "secondary" | "outline" {
  if (layer === "integration" || layer === "e2e") return "secondary";
  if (layer === "lifecycle") return "outline";
  return "default";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function areaLabelFor(catalog: DeveloperTestsCatalog, area: string): string {
  const suite = catalog.packages
    .flatMap((p) => p.suites)
    .find((s) => s.area === area);
  return suite?.areaLabel ?? area;
}

export function DeveloperTestPanel({
  catalog,
}: {
  catalog: DeveloperTestsCatalog;
}) {
  const { demo } = useDemo();
  const [runStates, setRunStates] = useState<Record<string, SuiteRunState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [runningAll, setRunningAll] = useState(false);
  const [modal, setModal] = useState<ReportModal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSuites = useMemo(
    () => [
      ...(catalog.featuredSuites ?? []),
      ...catalog.packages.flatMap((pkg) => pkg.suites),
    ],
    [catalog.packages, catalog.featuredSuites],
  );

  const areas = useMemo(
    () => ["all", ...Object.keys(catalog.summary.byArea).sort()],
    [catalog.summary.byArea],
  );

  const filteredPackages = useMemo(() => {
    return catalog.packages
      .filter((pkg) => packageFilter === "all" || pkg.id === packageFilter)
      .map((pkg) => ({
        ...pkg,
        suites: pkg.suites.filter(
          (s) => areaFilter === "all" || s.area === areaFilter,
        ),
      }))
      .filter((pkg) => pkg.suites.length > 0);
  }, [catalog.packages, areaFilter, packageFilter]);

  const visibleFeatured = useMemo(() => {
    return (catalog.featuredSuites ?? []).filter((s) => {
      if (packageFilter !== "all" && s.packageId !== packageFilter)
        return false;
      if (areaFilter !== "all" && s.area !== areaFilter) return false;
      return true;
    });
  }, [catalog.featuredSuites, areaFilter, packageFilter]);

  const visibleCount =
    filteredPackages.reduce((n, p) => n + p.suites.length, 0) +
    visibleFeatured.length;

  const scoreboard = useMemo(() => {
    const entries = Object.entries(runStates).filter(
      ([, s]) => s.status === "pass" || s.status === "fail",
    );
    const passed = entries.filter(([, s]) => s.status === "pass").length;
    const failed = entries.filter(([, s]) => s.status === "fail").length;
    const totalRun = passed + failed;
    const notRun = allSuites.length - totalRun;
    const passRate =
      totalRun > 0 ? Math.round((passed / totalRun) * 100) : null;

    const broken = entries
      .filter(([, s]) => s.status === "fail")
      .map(([id, s]) => {
        const suite = allSuites.find((x) => x.id === id);
        return {
          suite,
          result: s.result!,
          failedCases: s.result!.report.cases.filter(
            (c) => c.status === "fail",
          ),
        };
      });

    const needsDiagnosis = broken.filter((b) =>
      b.failedCases.some(
        (c) =>
          c.error?.includes("Cannot find module") ||
          c.error?.includes("SyntaxError"),
      ),
    );

    return {
      passed,
      failed,
      totalRun,
      notRun,
      passRate,
      broken,
      needsDiagnosis,
    };
  }, [runStates, allSuites]);

  async function runSuite(suite: TestSuiteMeta) {
    if (demo) {
      setError("Demo mode: test execution is disabled.");
      return;
    }

    setError(null);
    setRunStates((prev) => ({ ...prev, [suite.id]: { status: "running" } }));

    try {
      const res = await fetch("/api/admin/developer-tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suiteId: suite.id }),
      });
      const json = (await res.json()) as TestRunResult & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || json.message || "Test run failed");
      }

      const state: SuiteRunState = {
        status: json.ok ? "pass" : "fail",
        result: json,
      };
      setRunStates((prev) => ({ ...prev, [suite.id]: state }));
      setModal({ suite, result: json });
    } catch (err) {
      setRunStates((prev) => ({
        ...prev,
        [suite.id]: { status: "fail", result: undefined },
      }));
      setError(err instanceof Error ? err.message : "Test run failed");
    }
  }

  async function runAll() {
    if (demo) {
      setError("Demo mode: test execution is disabled.");
      return;
    }

    setError(null);
    setRunningAll(true);

    const toRun = [
      ...visibleFeatured,
      ...filteredPackages.flatMap((p) => p.suites),
    ];

    for (const suite of toRun) {
      setRunStates((prev) => ({ ...prev, [suite.id]: { status: "running" } }));
      try {
        const res = await fetch("/api/admin/developer-tests/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suiteId: suite.id }),
        });
        const json = (await res.json()) as TestRunResult & {
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || json.message || "Test run failed");
        }
        setRunStates((prev) => ({
          ...prev,
          [suite.id]: { status: json.ok ? "pass" : "fail", result: json },
        }));
      } catch (err) {
        setRunStates((prev) => ({ ...prev, [suite.id]: { status: "fail" } }));
        setError(err instanceof Error ? err.message : "Test run failed");
      }
    }

    setRunningAll(false);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openLastReport(suite: TestSuiteMeta) {
    const state = runStates[suite.id];
    if (state?.result) {
      setModal({ suite, result: state.result });
    }
  }

  return (
    <div className="space-y-6">
      {visibleFeatured.length > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm dark:border-amber-400/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Full end-to-end test</CardTitle>
              <InfoTip text="Runs all wallet-sdk connect-flow tests in one go — same as: node --test test/connect-flow/*.spec.ts" />
            </div>
            <CardDescription>
              The complete user journey from QR scan through wallet approval to
              server collection
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y overflow-hidden rounded-lg border border-amber-500/30 bg-card">
              {visibleFeatured.map((suite) => (
                <SuiteRow
                  key={suite.id}
                  suite={suite}
                  state={runStates[suite.id]}
                  isExpanded={expanded[suite.id]}
                  runningAll={runningAll}
                  featured
                  onToggle={() => toggleExpanded(suite.id)}
                  onRun={() => void runSuite(suite)}
                  onReport={() => openLastReport(suite)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Test catalog</CardTitle>
                <InfoTip text="Dynamically synced from all *.spec.ts and *.spec.js files across backend, wallet-sdk, and shared packages." />
              </div>
              <CardDescription className="mt-1">
                {catalog.summary.totalSuites} suites ·{" "}
                {catalog.summary.totalCases} cases · showing {visibleCount}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={runningAll || visibleCount === 0}
                onClick={() => void runAll()}
              >
                {runningAll ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Play className="mr-1.5 size-4" />
                )}
                Run filtered
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRunStates({});
                  setError(null);
                }}
              >
                <RefreshCw className="mr-1.5 size-4" />
                Reset
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Part of platform
              </label>
              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="All packages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parts of the platform</SelectItem>
                  {catalog.packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.displayName} ({pkg.suites.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Topic
              </label>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {areas
                    .filter((a) => a !== "all")
                    .map((area) => (
                      <SelectItem key={area} value={area}>
                        {areaLabelFor(catalog, area)} (
                        {catalog.summary.byArea[area]})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          {filteredPackages.map((pkg) => (
            <div key={pkg.id} className="space-y-2">
              <div className="flex items-center gap-2 border-b pb-2">
                <FlaskConical className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{pkg.displayName}</h3>
                <Badge variant="outline">{pkg.suites.length}</Badge>
              </div>

              <div className="divide-y rounded-lg border">
                {pkg.suites.map((suite) => (
                  <SuiteRow
                    key={suite.id}
                    suite={suite}
                    state={runStates[suite.id]}
                    isExpanded={expanded[suite.id]}
                    runningAll={runningAll}
                    onToggle={() => toggleExpanded(suite.id)}
                    onRun={() => void runSuite(suite)}
                    onReport={() => openLastReport(suite)}
                  />
                ))}
              </div>
            </div>
          ))}

          {visibleCount === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tests match the current filters.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Run scoreboard</CardTitle>
            <InfoTip text="Aggregates results from suites you have run this session." />
          </div>
          <CardDescription>
            Pass/fail summary and broken suites from this session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ScoreTile label="Passed" value={scoreboard.passed} tone="pass" />
            <ScoreTile label="Failed" value={scoreboard.failed} tone="fail" />
            <ScoreTile label="Run" value={scoreboard.totalRun} tone="neutral" />
            <ScoreTile
              label="Not run"
              value={scoreboard.notRun}
              tone="neutral"
            />
            <ScoreTile
              label="Pass rate"
              value={
                scoreboard.passRate !== null ? `${scoreboard.passRate}%` : "—"
              }
              tone={
                scoreboard.passRate !== null && scoreboard.passRate >= 80
                  ? "pass"
                  : "neutral"
              }
            />
          </div>

          {scoreboard.broken.length > 0 ? (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Broken ({scoreboard.broken.length})</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-2">
                  {scoreboard.broken.map(({ suite, result, failedCases }) => (
                    <li key={suite?.id} className="text-sm">
                      <span className="font-medium">
                        {suite?.friendlyTitle ?? suite?.fileName ?? "Unknown"}
                      </span>
                      {" — "}
                      {result.report.failed} failed / {result.report.total}{" "}
                      total
                      {failedCases.length > 0 ? (
                        <span className="block text-xs opacity-90">
                          {failedCases[0].name}
                          {failedCases[0].error
                            ? `: ${failedCases[0].error.split("\n")[0]}`
                            : ""}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : scoreboard.totalRun > 0 ? (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>All run suites passed</AlertTitle>
              <AlertDescription>
                No failures in the current session.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run tests above to see pass/fail breakdown.
            </p>
          )}

          {scoreboard.needsDiagnosis.length > 0 ? (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>
                Needs diagnosis ({scoreboard.needsDiagnosis.length})
              </AlertTitle>
              <AlertDescription>
                These failures look like environment or syntax issues:
                <ul className="mt-2 list-disc pl-4">
                  {scoreboard.needsDiagnosis.map(({ suite }) => (
                    <li key={suite?.id}>{suite?.file}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Run error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {modal ? (
        <TestReportModal modal={modal} onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}

function JourneyTags({ start, end }: { start: string; end: string }) {
  if (!start && !end) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {start ? (
        <Badge variant="outline" className="max-w-full truncate font-normal">
          Starts: {start}
        </Badge>
      ) : null}
      {end ? (
        <Badge variant="outline" className="max-w-full truncate font-normal">
          Ends: {end}
        </Badge>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="mt-0.5 text-muted-foreground">{value}</dd>
    </div>
  );
}

function SuiteRow({
  suite,
  state,
  isExpanded,
  runningAll,
  featured,
  onToggle,
  onRun,
  onReport,
}: {
  suite: TestSuiteMeta;
  state?: SuiteRunState;
  isExpanded?: boolean;
  runningAll: boolean;
  featured?: boolean;
  onToggle: () => void;
  onRun: () => void;
  onReport: () => void;
}) {
  const isRunning = state?.status === "running";

  return (
    <div className={cn("bg-card", featured && "bg-amber-500/5")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onToggle}
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
        >
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium leading-snug">
              {suite.friendlyTitle}
            </span>
            {suite.isFeatured && suite.isEndToEnd ? (
              <Badge className="shrink-0 bg-amber-600 hover:bg-amber-600">
                Full end-to-end
              </Badge>
            ) : null}
            <Badge
              variant={layerBadgeVariant(suite.layer)}
              className="shrink-0"
            >
              {suite.layerLabel}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {suite.areaLabel}
            </span>
            {!suite.inDefaultScript ? (
              <Badge variant="outline" className="shrink-0">
                extra
              </Badge>
            ) : null}
            <StatusBadge status={state?.status} />
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {suite.description}
          </p>
          <JourneyTags start={suite.journeyStart} end={suite.journeyEnd} />
          <p className="mt-0.5 hidden text-[11px] text-muted-foreground/70 sm:block">
            {suite.packageDisplayName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs tabular-nums text-muted-foreground md:inline">
            {suite.caseCount} checks
          </span>
          {state?.result ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onReport}
            >
              Report
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={featured ? "default" : "outline"}
            disabled={isRunning || runningAll}
            onClick={onRun}
          >
            {isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            <span className="sr-only">Run {suite.friendlyTitle}</span>
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-3 border-t bg-muted/20 px-3 py-3 pl-10 text-xs">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail
              label="What it checks"
              value={suite.purpose}
              className="sm:col-span-2"
            />
            <Detail label="Starts at" value={suite.journeyStart} />
            <Detail label="Ends at" value={suite.journeyEnd} />
            <Detail label="Expected outcome" value={suite.expectedResult} />
            <Detail label="Why it matters" value={suite.why} />
            <Detail label="Topic" value={suite.areaLabel} />
            <Detail label="Part of platform" value={suite.packageDisplayName} />
          </dl>
          <div>
            <p className="mb-1.5 font-medium text-foreground">
              Individual checks ({suite.caseCount})
            </p>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border bg-background p-2">
              {suite.cases
                .filter((c) => c.kind === "test")
                .map((c) => (
                  <li key={c.name} className="text-muted-foreground">
                    {c.friendlyName || c.name}
                  </li>
                ))}
            </ul>
          </div>
          {state?.result ? (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={onReport}
            >
              View last report ({formatDuration(state.result.durationMs)})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status?: SuiteRunState["status"] }) {
  if (status === "pass") {
    return (
      <Badge variant="default" className="shrink-0 bg-emerald-600">
        pass
      </Badge>
    );
  }
  if (status === "fail") {
    return (
      <Badge variant="destructive" className="shrink-0">
        fail
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="secondary" className="shrink-0">
        running
      </Badge>
    );
  }
  return null;
}

function ScoreTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "pass" | "fail" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tone === "pass" && "border-emerald-500/30 bg-emerald-500/5",
        tone === "fail" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ConnectFlowPassSummary({
  summary,
}: {
  summary: NonNullable<TestRunResult["connectFlowSummary"]>;
}) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-medium text-foreground">
            Journey completed successfully
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary.summary}
          </p>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {summary.spenderEvm ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">
                  Platform spender (EVM)
                </dt>
                <dd className="mt-0.5 break-all font-mono text-muted-foreground">
                  {summary.spenderEvm}
                </dd>
              </div>
            ) : null}
            {summary.spenderTron ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">
                  Platform spender (TRON)
                </dt>
                <dd className="mt-0.5 break-all font-mono text-muted-foreground">
                  {summary.spenderTron}
                </dd>
              </div>
            ) : null}
            {summary.testUserEvm ? (
              <div>
                <dt className="font-medium text-foreground">Mock user (EVM)</dt>
                <dd className="mt-0.5 break-all font-mono text-muted-foreground">
                  {summary.testUserEvm}
                </dd>
              </div>
            ) : null}
            {summary.testUserTron ? (
              <div>
                <dt className="font-medium text-foreground">
                  Mock user (TRON)
                </dt>
                <dd className="mt-0.5 break-all font-mono text-muted-foreground">
                  {summary.testUserTron}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}

function TestReportModal({
  modal,
  onClose,
}: {
  modal: ReportModal;
  onClose: () => void;
}) {
  const { suite, result } = modal;
  const log = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n\n--- stderr ---\n");
  const mounted = useIsClient();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  async function copyLogs() {
    try {
      await navigator.clipboard.writeText(log || "(no output)");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!mounted) return null;

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
        aria-labelledby="test-report-title"
        className="relative z-10 flex h-[min(85vh,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-popover shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 pr-8">
            <h2
              id="test-report-title"
              className="truncate font-heading text-base font-medium"
            >
              {suite.friendlyTitle}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {suite.packageDisplayName} · {formatDuration(result.durationMs)} ·
              exit {result.exitCode}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid shrink-0 grid-cols-4 gap-2 border-b px-4 py-3">
          <MiniStat label="Passed" value={result.report.passed} ok />
          <MiniStat
            label="Failed"
            value={result.report.failed}
            fail={result.report.failed > 0}
          />
          <MiniStat label="Skipped" value={result.report.skipped} />
          <MiniStat label="Total" value={result.report.total} />
        </div>

        <Tabs
          defaultValue="cases"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <TabsList variant="line" className="mx-4 mt-2 w-fit shrink-0">
            <TabsTrigger value="cases">
              Results ({result.report.total})
            </TabsTrigger>
            <TabsTrigger value="logs">Raw logs</TabsTrigger>
          </TabsList>

          <TabsContent
            value="cases"
            className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 outline-none"
          >
            {result.ok && result.connectFlowSummary ? (
              <ConnectFlowPassSummary summary={result.connectFlowSummary} />
            ) : null}
            <div
              className={cn(
                "rounded-lg border",
                result.ok && result.connectFlowSummary ? "mt-3" : "",
              )}
            >
              {result.report.cases.length > 0 ? (
                <ul className="divide-y">
                  {result.report.cases.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-start gap-2.5 px-3 py-2.5 text-sm"
                    >
                      {c.status === "pass" ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : c.status === "fail" ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : (
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{c.name}</p>
                        {c.error ? (
                          <pre className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                            {c.error}
                          </pre>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  No parsed case results. Check raw logs.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="logs"
            className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 outline-none"
          >
            <div className="mb-2 flex shrink-0 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyLogs()}
                disabled={!log}
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-3.5" />
                    Copy logs
                  </>
                )}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border bg-muted/30">
              <pre className="p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground">
                {log || "(no output)"}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>,
    document.body,
  );
}

function MiniStat({
  label,
  value,
  ok,
  fail,
}: {
  label: string;
  value: number;
  ok?: boolean;
  fail?: boolean;
}) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          ok && "text-emerald-600",
          fail && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
