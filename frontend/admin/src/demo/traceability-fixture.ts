/** Demo data for transaction journey / traceability admin pages. */

import {
  TRANSACTION_TERMINAL_STAGES,
  type TransactionTerminalStatus,
} from "@trustmycard/shared/constants/transaction-lifecycle";
import { generateFlowId } from "@trustmycard/shared/ids/flow-id";
import {
  generatePublicId,
  type PublicIdKind,
} from "@trustmycard/shared/ids/public-id";

function demoWallet(n: number): string {
  const i = n - 1;
  if (i % 7 === 0) {
    const suffix = i.toString(16).toUpperCase().padStart(8, "0");
    return `TDemo${suffix}${"X".repeat(26)}`.slice(0, 34);
  }
  return `0x${(1000 + i).toString(16).padStart(40, "0")}`.slice(0, 42);
}

/** Stable IST instant per demo journey slot (IDs do not change on reload). */
function demoFlowInstant(n: number): Date {
  const base = new Date("2026-08-01T03:45:00.000Z");
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + (n - 1));
  d.setUTCHours(d.getUTCHours() + (n % 6));
  d.setUTCMinutes((n * 11) % 60);
  d.setUTCSeconds(n % 60);
  return d;
}

/** Semantic journey ID for demo slot 1–10. */
export function flowId(n: number, walletAddress?: string): string {
  const wallet = walletAddress ?? demoWallet(n);
  return generateFlowId({ walletAddress: wallet, now: demoFlowInstant(n) });
}

export const DEMO_FLOW_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
  flowId(n),
);

export function demoPublicId(
  kind: PublicIdKind,
  qualifier: string,
  journeyId: string,
  sequence?: number,
): string {
  return generatePublicId(kind, qualifier, journeyId, sequence);
}

export function demoFlowIndex(transactionId: string): number {
  const idx = DEMO_FLOW_IDS.indexOf(transactionId);
  if (idx >= 0) return idx + 1;
  const legacy = /^flow-demo-(\d+)$/.exec(transactionId.trim());
  if (legacy) return Number(legacy[1]);
  return 1;
}

export function demoTerminalStatusForFlowIndex(
  flowIndex: number,
  listIndex?: number,
): TransactionTerminalStatus {
  if (flowIndex === 2) return "FAILED";
  if (flowIndex === 3) return "CANCELLED";
  if (flowIndex === 4) return "EXPIRED";
  if (listIndex != null && listIndex % 5 === 0) return "IN_PROGRESS";
  return "SUCCESS";
}

export type DemoSettlementSession = {
  id: string;
  publicId: string;
  clientSessionId: string;
  traceId: string;
  ownerAddress: string;
  network: string;
  status: string;
  statusLabel: string;
  usdtApprovalTxHash: string | null;
  usdcApprovalTxHash: string | null;
  usdtSettled: boolean;
  usdcSettled: boolean;
  nativeAuthKind: string | null;
  nativeReady: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  tokenReadiness?: {
    canExecuteNative: boolean;
    tokens: Array<{
      token: string;
      state: string;
      stateLabel: string;
      active: boolean;
    }>;
  };
};

export function buildDemoSettlementSessions(
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
  txHash: (i: number, tag?: string) => string,
): DemoSettlementSession[] {
  const statuses = [
    "COMPLETED",
    "FAILED",
    "EXECUTING_NATIVE",
    "WALLET_PHASE_COMPLETE",
    "AWAITING_NATIVE",
  ] as const;
  const labels: Record<string, string> = {
    COMPLETED: "Completed",
    FAILED: "Failed",
    EXECUTING_NATIVE: "Executing native",
    WALLET_PHASE_COMPLETE: "Wallet phase complete",
    AWAITING_NATIVE: "Awaiting native",
  };

  return Array.from({ length: 24 }, (_, i) => {
    const network = networks[i % networks.length];
    const owner = owners[i % owners.length];
    const status = statuses[i % statuses.length];
    const slot = (i % 10) + 1;
    const clientSessionId = flowId(slot, owner);
    const complete = status === "COMPLETED";
    const failed = status === "FAILED";
    return {
      id: `demo-settle-${i + 1}`,
      publicId: demoPublicId("settlement", network, clientSessionId),
      clientSessionId,
      traceId: clientSessionId,
      ownerAddress: owner,
      network,
      status,
      statusLabel: labels[status] ?? status,
      usdtApprovalTxHash: txHash(i + 1, "u1"),
      usdcApprovalTxHash: i % 3 === 0 ? null : txHash(i + 2, "u2"),
      usdtSettled: complete || (status === "EXECUTING_NATIVE" && i % 2 === 0),
      usdcSettled: complete,
      nativeAuthKind: complete
        ? "deferred"
        : status === "AWAITING_NATIVE"
          ? "deferred"
          : null,
      nativeReady: complete || status === "EXECUTING_NATIVE",
      lastError: failed
        ? "Native transfer reverted: insufficient energy"
        : null,
      createdAt: daysAgo(i % 20, 10),
      updatedAt: daysAgo(i % 15, 14),
      completedAt: complete ? daysAgo(i % 10, 16) : null,
      tokenReadiness: {
        canExecuteNative: complete,
        tokens: [
          {
            token: "USDT",
            state: complete ? "settled" : failed ? "failed" : "active",
            stateLabel: complete ? "Settled" : failed ? "Failed" : "Collecting",
            active: !complete && !failed,
          },
          {
            token: "USDC",
            state: complete ? "settled" : "waiting",
            stateLabel: complete ? "Settled" : "Waiting",
            active: !complete,
          },
        ],
      },
    };
  });
}

export function buildDemoTransactionJourney(
  transactionId: string,
  owners: string[],
  networks: readonly string[],
  now: string,
  daysAgo: (n: number, hour?: number) => string,
  txHash: (i: number, tag?: string) => string,
) {
  const flowIndex = demoFlowIndex(transactionId);
  const walletAddress =
    owners[(flowIndex - 1) % owners.length] ?? owners[0] ?? "0xdemo";
  const network =
    networks[(flowIndex - 1) % networks.length] ?? networks[0] ?? "eth";
  const terminalStatus = demoTerminalStatusForFlowIndex(flowIndex);
  const journeyId = DEMO_FLOW_IDS[flowIndex - 1] ?? transactionId;

  const terminalStage =
    terminalStatus === "SUCCESS"
      ? TRANSACTION_TERMINAL_STAGES.SUCCESS
      : terminalStatus === "FAILED"
        ? TRANSACTION_TERMINAL_STAGES.FAILED
        : terminalStatus === "CANCELLED"
          ? TRANSACTION_TERMINAL_STAGES.CANCELLED
          : TRANSACTION_TERMINAL_STAGES.EXPIRED;

  return {
    transactionId: journeyId,
    terminalStatus,
    startedAt: daysAgo(2, 9),
    completedAt: terminalStatus === "SUCCESS" ? daysAgo(1, 11) : daysAgo(0, 8),
    walletAddress,
    network,
    timeline: {
      sessionId: journeyId,
      walletAddress,
      network,
      startedAt: daysAgo(2, 9),
      completedAt: daysAgo(1, 11),
      outcome: terminalStatus === "SUCCESS" ? "success" : "failed",
      totalDurationMs: 18600,
      events: [
        {
          eventId: "n1",
          stage: "AUTHORIZATION_STARTED",
          status: "started",
          ts: daysAgo(2, 9),
          message: "Connect flow started",
          depth: 0,
        },
        {
          eventId: "n2",
          parentEventId: "n1",
          stage: "WALLET_CONNECTED",
          status: "success",
          ts: daysAgo(2, 9),
          durationMs: 1200,
          message: "Wallet linked",
          depth: 1,
        },
        {
          eventId: "n3",
          parentEventId: "n1",
          stage: terminalStage,
          status: terminalStatus === "SUCCESS" ? "success" : "failure",
          ts: daysAgo(1, 11),
          durationMs: 8200,
          message: `Journey ${terminalStatus.toLowerCase()}`,
          depth: 1,
        },
      ],
    },
    observabilityEvents: [
      {
        id: "obs-j-1",
        ts: daysAgo(2, 9),
        module: "connect",
        operation: "scan",
        stage: "SCAN STARTED",
        status: "in_progress",
        message: "QR scan started",
        txHash: null,
      },
      {
        id: "obs-j-2",
        ts: daysAgo(1, 11),
        module: "wallet-service",
        operation: "approval_confirm",
        stage: terminalStage,
        status: terminalStatus === "SUCCESS" ? "success" : "failure",
        message: `Terminal ${terminalStage}`,
        txHash: txHash(1, "j"),
      },
    ],
    approvals: [
      {
        id: "demo-ap-trace-1",
        publicId: demoPublicId("approval", "usdt", journeyId),
        network,
        tokenSymbol: "USDT",
        status: terminalStatus === "SUCCESS" ? "ACTIVE" : "FAILED",
        txHash: txHash(2, "ap"),
        traceId: journeyId,
      },
    ],
    collectionIntents: [
      {
        id: "demo-ci-1",
        publicId: demoPublicId("collect", "usdt", journeyId),
        approvalId: "demo-ap-trace-1",
        network,
        tokenSymbol: "USDT",
        status: terminalStatus === "SUCCESS" ? "SETTLED" : "FAILED",
        traceId: journeyId,
      },
    ],
    transfers: [
      {
        id: "demo-tr-trace-1",
        publicId: demoPublicId("transfer", "usdt", journeyId),
        network,
        tokenSymbol: "USDT",
        status: terminalStatus === "SUCCESS" ? "confirmed" : "failed",
        txHash: txHash(4, "tr"),
        traceId: journeyId,
        createdAt: daysAgo(1, 10),
      },
    ],
    settlementSessions: [
      {
        id: "demo-settle-trace-1",
        publicId: demoPublicId("settlement", network, journeyId),
        clientSessionId: journeyId,
        network,
        status: terminalStatus === "SUCCESS" ? "COMPLETED" : "FAILED",
        traceId: journeyId,
        completedAt: terminalStatus === "SUCCESS" ? daysAgo(1, 11) : null,
      },
    ],
    tgEvents: [
      {
        id: "demo-tg-trace-1",
        type: "approve",
        network,
        address: walletAddress,
        status: terminalStatus === "SUCCESS" ? "success" : "error",
        createdAt: daysAgo(2, 10),
        traceId: journeyId,
      },
    ],
    nativeTransfers: [
      {
        id: "demo-nt-trace-1",
        publicId: demoPublicId(
          "transfer-native",
          network === "tron" ? "trx" : network === "bsc" ? "bnb" : "eth",
          journeyId,
        ),
        network,
        txHash: txHash(3, "nt"),
        status: terminalStatus === "SUCCESS" ? "confirmed" : "failed",
        traceId: journeyId,
      },
    ],
    txHashes: [
      txHash(1, "j"),
      txHash(2, "ap"),
      txHash(3, "nt"),
      txHash(4, "tr"),
    ],
    pipeline: null,
  };
}

export function buildDemoTransactionList(
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
) {
  const demoTokens = [
    "USDT",
    "USDC",
    "ETH",
    "TRX",
    "BNB",
    "USDT, USDC",
  ] as const;
  return DEMO_FLOW_IDS.map((transactionId, i) => {
    const flowIndex = i + 1;
    const terminalStatus = demoTerminalStatusForFlowIndex(flowIndex, i);
    const network = networks[i % networks.length] ?? null;
    const token =
      demoTokens[i % demoTokens.length] ??
      (network === "tron" ? "TRX" : network === "bsc" ? "BNB" : "ETH");
    return {
      transactionId,
      terminalStatus,
      walletAddress: owners[i % owners.length] ?? null,
      network,
      token,
      startedAt: daysAgo(3 + (i % 4), 8 + i),
      lastActivityAt: daysAgo(i % 3, 10 + i),
      eventCount: 12 + i * 3,
    };
  });
}

export function buildDemoDeveloperTestsCatalog() {
  const traceabilityCases = [
    {
      name: "generateTransactionId returns semantic flow-* ID",
      friendlyName: "Transaction IDs use semantic flow- prefix",
      kind: "it" as const,
    },
    {
      name: "correlationHeaders sets x-correlation-id when id provided",
      friendlyName: "Correlation header propagation",
      kind: "it" as const,
    },
    {
      name: "reconcileActiveTransactionOnMount marks expired stale transactions",
      friendlyName: "Refresh expires stale journeys",
      kind: "it" as const,
    },
    {
      name: "runAuthorizationSession uses provided transactionId as canonical sessionId",
      friendlyName: "Auth session uses journey ID",
      kind: "test" as const,
    },
    {
      name: "transaction journey service aggregates by traceId",
      friendlyName: "Admin hub aggregates by trace ID",
      kind: "test" as const,
    },
    {
      name: "recognizes terminal stages",
      friendlyName: "Terminal lifecycle stages",
      kind: "it" as const,
    },
  ];

  const suite = (
    id: string,
    file: string,
    title: string,
    packageId: string,
    packageName: string,
  ) => ({
    id,
    packageId,
    packageName,
    packageDisplayName:
      packageId === "backend"
        ? "Server & background jobs"
        : packageId === "wallet-sdk"
          ? "Wallet connect & approvals"
          : "Core platform rules",
    file,
    fileName: file.split("/").pop() ?? file,
    friendlyTitle: title,
    area: "Transaction traceability",
    areaLabel: "Transaction ID & journey tracing",
    layer: "unit",
    layerLabel: "Single piece",
    inDefaultScript: true,
    isFeatured: false,
    isEndToEnd: false,
    journeyStart: "User opens connect flow",
    journeyEnd: "Journey visible in admin hub",
    description:
      "Validates that one semantic flow-* ID follows the user from connect through settlement and appears in admin.",
    purpose:
      "Catch regressions where logs, workers, or admin pages lose correlation.",
    expectedResult:
      "Same transactionId on client, server rows (with publicIds), webhooks, and GET /admin/transactions/:id.",
    why: "Traceability is the primary debugging tool for production payment issues.",
    cases: traceabilityCases,
    caseCount: traceabilityCases.length,
  });

  const packages = [
    {
      id: "wallet-sdk",
      name: "@trustmycard/wallet-sdk",
      displayName: "Wallet connect & approvals",
      cwd: "frontend/wallet-sdk",
      suites: [
        suite(
          "wallet-sdk:test/core/transaction-context.spec.ts",
          "test/core/transaction-context.spec.ts",
          "Transaction context (sessionStorage & headers)",
          "wallet-sdk",
          "@trustmycard/wallet-sdk",
        ),
        suite(
          "wallet-sdk:test/authorization/session.spec.ts",
          "test/authorization/session.spec.ts",
          "Authorization session journey ID",
          "wallet-sdk",
          "@trustmycard/wallet-sdk",
        ),
      ],
    },
    {
      id: "backend",
      name: "@trustmycard/backend",
      displayName: "Server & background jobs",
      cwd: "backend",
      suites: [
        suite(
          "backend:test/transaction-journey.spec.ts",
          "test/transaction-journey.spec.ts",
          "Transaction journey admin aggregate",
          "backend",
          "@trustmycard/backend",
        ),
        suite(
          "backend:test/settlement-observability.spec.ts",
          "test/settlement-observability.spec.ts",
          "Settlement observability correlation",
          "backend",
          "@trustmycard/backend",
        ),
      ],
    },
    {
      id: "shared",
      name: "@trustmycard/shared",
      displayName: "Core platform rules",
      cwd: "frontend/shared",
      suites: [
        suite(
          "shared:test/transaction-lifecycle.spec.js",
          "test/transaction-lifecycle.spec.js",
          "Transaction terminal lifecycle constants",
          "shared",
          "@trustmycard/shared",
        ),
      ],
    },
  ];

  const totalSuites = packages.reduce((n, p) => n + p.suites.length, 0);

  return {
    enabled: true,
    packages,
    featuredSuites: [],
    summary: {
      totalSuites,
      totalCases: traceabilityCases.length * totalSuites,
      byArea: { "Transaction traceability": totalSuites },
      byLayer: { unit: totalSuites },
    },
  };
}
