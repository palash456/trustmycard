/** Demo fixtures — ~1 month of fictional app usage across all admin pages. */

import { buildDemoActivity, buildDemoAnalytics } from "./analytics-fixture";
import {
  buildDemoObservabilityEvents,
  filterDemoObservabilityEvents,
  findDemoSessionTimeline,
} from "./observability-fixture";
import { buildDemoPipelineSnapshot, demoBalances } from "./pipeline-fixture";
import {
  buildDemoDeveloperTestsCatalog,
  buildDemoSettlementSessions,
  buildDemoTransactionJourney,
  buildDemoTransactionList,
  demoPublicId,
  flowId,
} from "./traceability-fixture";
import { formatAdminAmount } from "@/lib/amount-display";
import { getErrorMessage } from "@/lib/observability";

function demoErrorText(error: unknown): string | null {
  if (error == null || error === "") return null;
  const message = getErrorMessage(error, "");
  if (!message || message === "[object Object]") return null;
  return message;
}

function daysAgo(n: number, hour = 12): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, (n * 7) % 60, 0, 0);
  return d.toISOString();
}

function addr(i: number): string {
  return `0x${i.toString(16).padStart(40, "0")}`.slice(0, 42);
}

function tronAddr(i: number): string {
  const suffix = i.toString(16).toUpperCase().padStart(8, "0");
  return `TDemo${suffix}${"X".repeat(26)}`.slice(0, 34);
}

function txHash(i: number, tag = "aa"): string {
  return `0x${tag}${i.toString(16).padStart(62, "0")}`.slice(0, 66);
}

const NETWORKS = ["pol", "eth", "bsc", "tron", "arb", "base", "op"] as const;
const TOKENS = ["USDT", "USDC"] as const;
const APPROVAL_STATUSES = [
  "ACTIVE",
  "PARTIALLY_USED",
  "COMPLETED",
  "SUBMITTED",
  "FAILED",
  "REVOKED",
  "EXPIRED",
] as const;
const TRANSFER_STATUSES = [
  "confirmed",
  "pending",
  "failed",
  "broadcast",
] as const;
const NATIVE_STATUSES = ["confirmed", "pending", "failed"] as const;
const EVENT_TYPES = ["scan", "approve", "native_transfer", "connect"] as const;

const OWNERS = Array.from({ length: 48 }, (_, i) =>
  i % 7 === 0 ? tronAddr(i) : addr(1000 + i),
);

function nativeQualifier(network: string): string {
  if (network === "tron") return "trx";
  if (network === "bsc") return "bnb";
  return "eth";
}

function buildApprovals() {
  return Array.from({ length: 120 }, (_, i) => {
    const network = NETWORKS[i % NETWORKS.length];
    const owner = OWNERS[i % OWNERS.length];
    const status = APPROVAL_STATUSES[i % APPROVAL_STATUSES.length];
    const tokenSymbol = TOKENS[i % TOKENS.length];
    const traceId = flowId((i % 10) + 1, owner);
    return {
      id: `demo-ap-${i + 1}`,
      publicId: demoPublicId("approval", tokenSymbol, traceId),
      ownerAddress: owner,
      network,
      tokenSymbol,
      status,
      traceId,
      collectedRaw: String((i % 20) * 1_000_000),
      remainingRaw: String(Math.max(0, (30 - (i % 20)) * 1_000_000)),
      collectionEnabled: status === "ACTIVE" || status === "PARTIALLY_USED",
      nextCheckAt: status === "ACTIVE" ? daysAgo(i % 10, 8) : null,
      lastError:
        status === "FAILED" ? "RPC timeout during allowance read" : null,
      createdAt: daysAgo(i % 30, 10 + (i % 8)),
    };
  });
}

function buildTransfers() {
  return Array.from({ length: 200 }, (_, i) => {
    const network = NETWORKS[i % (NETWORKS.length - 1)];
    const owner = OWNERS[i % OWNERS.length];
    const tokenSymbol = TOKENS[i % TOKENS.length];
    const traceId = flowId(((i % 120) % 10) + 1, owner);
    return {
      id: `demo-tr-${i + 1}`,
      publicId: demoPublicId("transfer", tokenSymbol, traceId),
      amountRaw: String((i + 1) * 250_000),
      status: TRANSFER_STATUSES[i % TRANSFER_STATUSES.length],
      txHash: i % 5 === 0 ? null : txHash(i, "tf"),
      fromAddress: owner,
      toAddress: addr(1),
      createdAt: daysAgo(i % 30, 11 + (i % 6)),
      approval: {
        id: `demo-ap-${(i % 120) + 1}`,
        network,
        tokenSymbol,
        ownerAddress: owner,
        traceId,
      },
    };
  });
}

function buildNative() {
  return Array.from({ length: 90 }, (_, i) => {
    const network = NETWORKS[i % NETWORKS.length];
    const status = NATIVE_STATUSES[i % NATIVE_STATUSES.length];
    const owner = OWNERS[i % OWNERS.length];
    const traceId = flowId((i % 10) + 1, owner);
    return {
      id: `demo-nt-${i + 1}`,
      publicId: demoPublicId(
        "transfer-native",
        nativeQualifier(network),
        traceId,
      ),
      ownerAddress: owner,
      network,
      assetSymbol:
        network === "tron" ? "TRX" : network === "bsc" ? "BNB" : "ETH",
      amountHuman: (0.01 + (i % 50) * 0.002).toFixed(4),
      status,
      traceId,
      txHash: txHash(i, "nt"),
      reconcileAttempts:
        status === "pending" ? (i % 12) + 1 : status === "failed" ? 120 : 2,
      createdAt: daysAgo(i % 30, 14 + (i % 5)),
    };
  });
}

const TG_SITES = [
  "pay.trustmycard.local",
  "checkout.demo.app",
  "merchant.example.com",
  "localhost:3000",
] as const;

const TG_LOCATIONS = [
  "Singapore, SG",
  "Berlin, DE",
  "Austin, US",
  "Lagos, NG",
  "Tokyo, JP",
  "Mumbai, IN",
  "London, UK",
  "São Paulo, BR",
] as const;

function buildEvents() {
  return Array.from({ length: 480 }, (_, i) => {
    const day = i % 30;
    const type = EVENT_TYPES[i % EVENT_TYPES.length];
    const isError = i % 11 === 0;
    return {
      id: `demo-ev-${i + 1}`,
      type,
      network: NETWORKS[i % NETWORKS.length],
      address: OWNERS[i % OWNERS.length],
      status: isError ? "error" : "success",
      error: isError
        ? i % 22 === 0
          ? { message: "User rejected signature", code: "ACTION_REJECTED" }
          : i % 33 === 0
            ? { error: { message: "RPC timeout", reason: "ETIMEDOUT" } }
            : i % 44 === 0
              ? { message: "Insufficient balance", code: "INSUFFICIENT_FUNDS" }
              : i % 55 === 0
                ? "Session expired before signing"
                : "User rejected signature"
        : null,
      ip: `203.0.${(i % 200) + 1}.${(i % 250) + 1}`,
      location: TG_LOCATIONS[i % TG_LOCATIONS.length],
      site: TG_SITES[i % TG_SITES.length],
      device: i % 3 === 0 ? "Mobile" : i % 5 === 0 ? "Tablet" : "Desktop",
      createdAt: daysAgo(day, 8 + (i % 12)),
      traceId: flowId((i % 10) + 1, OWNERS[i % OWNERS.length]),
    };
  });
}

function buildAudits() {
  const actions = [
    "confirm",
    "transfer_executed",
    "settings.update",
    "collector.toggle",
    "approval.update",
    "register_pending",
    "native_transfer.recorded",
    "collection.queued",
    "collection.settled",
    "collection.failed",
    "retry.started",
    "recovery.completed",
  ] as const;
  const entityTypes = [
    "approval",
    "transfer",
    "settings",
    "collector",
    "native",
    "native_transfer",
    "settlement",
  ] as const;
  return Array.from({ length: 240 }, (_, i) => ({
    id: `demo-audit-${i + 1}`,
    actor:
      i % 5 === 0
        ? "admin"
        : i % 7 === 0
          ? "system:collector"
          : `owner:${OWNERS[i % OWNERS.length].slice(0, 12)}…`,
    action: actions[i % actions.length],
    entityType: entityTypes[i % entityTypes.length],
    entityId: i % 4 === 0 ? null : `demo-ap-${(i % 120) + 1}`,
    payload: {
      note: "demo month sample",
      day: i % 30,
      ok: i % 13 !== 0,
      network: NETWORKS[i % NETWORKS.length],
      traceId: flowId((i % 10) + 1, OWNERS[i % OWNERS.length]),
    },
    createdAt: daysAgo(i % 30, 15 + (i % 6)),
  }));
}

function buildWallets() {
  return OWNERS.map((address, i) => ({
    address,
    approvalCount: 1 + (i % 6),
    nativeTransferCount: i % 4,
    eventCount: 2 + (i % 10),
    lastSeen: daysAgo(i % 28, 18),
  }));
}

const approvals = buildApprovals();
const transfers = buildTransfers();
const nativeTransfers = buildNative();
const events = buildEvents();
const audits = buildAudits();
const observabilityEvents = buildDemoObservabilityEvents(
  OWNERS,
  NETWORKS,
  daysAgo,
  txHash,
);
const wallets = buildWallets();
const settlementSessions = buildDemoSettlementSessions(
  OWNERS,
  NETWORKS,
  daysAgo,
  txHash,
);

const WORKFLOW_STAGES = [
  "idle",
  "connected",
  "approving",
  "approved",
  "collecting",
  "completed",
  "native_pending",
  "failed",
] as const;

const HEALTH_STATUSES = ["healthy", "warning", "error", "idle"] as const;

function buildUsers() {
  return OWNERS.map((address, i) => {
    const ownerApprovals = approvals.filter((a) => a.ownerAddress === address);
    const ownerTransfers = transfers.filter((t) => t.fromAddress === address);
    const ownerNative = nativeTransfers.filter(
      (n) => n.ownerAddress === address,
    );
    const ownerEvents = events.filter((e) => e.address === address);
    const latestApproval = ownerApprovals[0];
    const latestTransfer = ownerTransfers[0];
    const latestNative = ownerNative[0];
    const networksUsed = [
      ...new Set([
        ...ownerApprovals.map((a) => a.network),
        ...ownerTransfers.map((t) => t.approval.network),
        ...ownerNative.map((n) => n.network),
        ...ownerEvents.map((e) => e.network),
      ]),
    ];
    const approvedChains = [
      ...new Set(
        ownerApprovals
          .filter((a) => a.status !== "REVOKED")
          .map((a) => a.network),
      ),
    ];
    const workflowStage =
      i === 0 ? "collecting" : WORKFLOW_STAGES[i % WORKFLOW_STAGES.length];
    const healthStatus =
      i === 0 ? "healthy" : HEALTH_STATUSES[i % HEALTH_STATUSES.length];
    const collectableRemaining =
      latestApproval &&
      (latestApproval.status === "ACTIVE" ||
        latestApproval.status === "PARTIALLY_USED")
        ? [
            {
              network: latestApproval.network,
              tokenSymbol: latestApproval.tokenSymbol,
              remainingRaw: latestApproval.remainingRaw,
              remainingHuman: (
                Number(latestApproval.remainingRaw) / 1_000_000
              ).toFixed(2),
              decimals: 6,
            },
          ]
        : [];
    const totalLifetimeCollectedMap = new Map<
      string,
      {
        network: string;
        tokenSymbol: string;
        collectedRaw: bigint;
        decimals: number;
      }
    >();
    for (const approval of ownerApprovals.slice(0, 2)) {
      const key = `${approval.network}:${approval.tokenSymbol}`;
      const existing = totalLifetimeCollectedMap.get(key);
      const amount = BigInt(approval.collectedRaw || "0");
      if (existing) {
        existing.collectedRaw += amount;
      } else {
        totalLifetimeCollectedMap.set(key, {
          network: approval.network,
          tokenSymbol: approval.tokenSymbol,
          collectedRaw: amount,
          decimals: 6,
        });
      }
    }
    const totalLifetimeCollected = [...totalLifetimeCollectedMap.values()].map(
      (item) => ({
        network: item.network,
        tokenSymbol: item.tokenSymbol,
        collectedRaw: item.collectedRaw.toString(),
        collectedHuman: (Number(item.collectedRaw) / 1_000_000).toFixed(2),
        decimals: item.decimals,
      }),
    );
    const latestError =
      latestApproval?.lastError ??
      (latestTransfer?.status === "failed" ? "insufficient allowance" : null) ??
      (latestNative?.status === "failed"
        ? "Receipt not found after max attempts"
        : null) ??
      demoErrorText(ownerEvents.find((e) => e.error)?.error);

    const userNumber = i + 1;
    const paddedUserNumber = String(userNumber).padStart(4, "0");
    const isTron = i % 7 === 0;
    const evmSuffix = isTron
      ? "ENON"
      : `E${String(901 + (i % 99)).padStart(3, "0")}`;
    const tronSuffix = isTron
      ? `T${String(401 + (i % 99)).padStart(3, "0")}`
      : "TNON";

    return {
      userId: `demo-user-${userNumber}`,
      publicId: `USR-${paddedUserNumber}-${evmSuffix}-${tronSuffix}`,
      username: `user-${paddedUserNumber}`,
      wallets: [{ address, chainType: isTron ? "tron" : "evm" }],
      address,
      firstSeen: daysAgo(28 - (i % 28), 8),
      lastActivity: daysAgo(i % 14, 18),
      networksUsed,
      approvedChains,
      activeChain: latestApproval?.network ?? networksUsed[0] ?? null,
      workflowStage,
      approvalStatus: latestApproval?.status ?? null,
      collectionStatus: latestApproval
        ? `${latestApproval.collectionEnabled ? "enabled" : "disabled"}:${latestApproval.status}`
        : null,
      transferStatus: latestTransfer?.status ?? null,
      nativeFundingStatus: latestNative?.status ?? null,
      reconciliationStatus:
        latestNative?.status === "pending"
          ? "reconciling"
          : (latestNative?.status ?? null),
      collectableRemaining,
      totalLifetimeCollected,
      approvalCount: ownerApprovals.length || 1 + (i % 6),
      transferCount: ownerTransfers.length || i % 5,
      nativeTransferCount: ownerNative.length || i % 4,
      eventCount: ownerEvents.length || 2 + (i % 10),
      latestTransaction: latestTransfer?.txHash
        ? {
            txHash: latestTransfer.txHash,
            at: latestTransfer.createdAt,
            source: "transfer",
          }
        : latestApproval
          ? {
              txHash: txHash(i, "ap"),
              at: latestApproval.createdAt,
              source: "approval",
            }
          : null,
      latestActivity: {
        at: daysAgo(i % 14, 18),
        type: "approval",
        label: latestApproval
          ? `${latestApproval.network} ${latestApproval.tokenSymbol}`
          : "scan · tron",
      },
      latestError,
      healthStatus,
    };
  });
}

const users = buildUsers();
const now = new Date().toISOString();

type DemoUser = (typeof users)[number];

function lookupDemoUserByWallet(
  address: string | null | undefined,
): DemoUser | undefined {
  if (!address?.trim()) return undefined;
  const needle = address.trim().toLowerCase();
  return users.find(
    (user) =>
      user.address.toLowerCase() === needle ||
      user.wallets.some((wallet) => wallet.address.toLowerCase() === needle),
  );
}

function demoUserFields(address: string | null | undefined) {
  const user = lookupDemoUserByWallet(address);
  return {
    userId: user?.userId ?? null,
    username: user?.username ?? null,
    userPublicId: user?.publicId ?? null,
  };
}

export const demoFixtures: Record<string, unknown> = {
  "/admin/dashboard": {
    ok: true,
    collector: {
      enabled: true,
      due: 17,
      leased: 3,
      approvals: {
        ACTIVE: 34,
        PARTIALLY_USED: 12,
        SUBMITTED: 5,
        COMPLETED: 58,
        FAILED: 6,
        REVOKED: 3,
        EXPIRED: 2,
      },
      transfers: {
        confirmed: 168,
        pending: 9,
        failed: 11,
        broadcast: 12,
        prepared: 6,
      },
    },
    nativeTransfers: { pending: 14, confirmed: 68, failed: 8 },
    recentObservabilityErrors: observabilityEvents
      .filter(
        (e) =>
          e.kind === "log" &&
          (e.level === "error" ||
            e.status === "failure" ||
            Boolean(e.errorMessage)),
      )
      .slice(0, 6)
      .map((e) => ({
        id: e.id,
        ts: e.ts,
        module: e.module,
        operation: e.operation,
        message: e.message,
        walletAddress: e.walletAddress,
        network: e.network,
        errorMessage: e.errorMessage,
        txHash: e.txHash,
        sessionId: e.sessionId,
        traceId: e.traceId,
      })),
    recentFailures: {
      approvals: approvals
        .filter((a) => a.lastError)
        .slice(0, 6)
        .map((a) => ({
          id: a.id,
          network: a.network,
          ownerAddress: a.ownerAddress,
          tokenSymbol: a.tokenSymbol,
          status: a.status,
          lastError: a.lastError,
        })),
      nativeTransfers: nativeTransfers
        .filter((n) => n.status === "failed")
        .slice(0, 5)
        .map((n) => ({
          id: n.id,
          network: n.network,
          ownerAddress: n.ownerAddress,
          assetSymbol: n.assetSymbol,
          status: n.status,
          errorMessage: "Receipt not found after max reconcile attempts",
        })),
    },
    settlement: {
      active: 4,
      recentFailed: settlementSessions
        .filter((s) => s.status === "FAILED")
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          ownerAddress: s.ownerAddress,
          network: s.network,
          status: s.status,
          lastError: s.lastError,
          updatedAt: s.updatedAt,
          clientSessionId: s.clientSessionId,
          traceId: s.traceId,
        })),
    },
    recentTransactions: buildDemoTransactionList(
      users.map((u) => u.address),
      NETWORKS,
      daysAgo,
    )
      .slice(0, 8)
      .map((row) => ({
        ...row,
        ...demoUserFields(row.walletAddress),
      })),
    timestamp: now,
  },

  "/admin/settings": {
    settings: {
      "permissions.allowSelfSpender": true,
      "collector.enabled": true,
      "collector.maxRuns": "unlimited",
      "collector.intervalMs": 120000,
      "collector.batchSize": 20,
      "collector.leaseMs": 900000,
      "collector.rpcTimeoutMs": 15000,
      "collection.defaultMode": "maximum",
      "collection.approveAmountUsdtDefault": "0",
      "collection.networkCaps": {
        pol: { usdt: "1000" },
        eth: { usdt: "5000" },
      },
      "native.reconcile.enabled": true,
      "native.reconcile.intervalMs": 60000,
      "native.reconcile.batchSize": 10,
      "resources.sponsorEnabled": true,
      "resources.tronEnergyProvider": "self",
      "resources.tronEnergyTarget": 65000,
      "resources.tronEnergyIdempotencyHours": 6,
    },
    lastReloadAt: daysAgo(0, 8),
  },

  "/admin/system/status": {
    secrets: {
      evm: {
        configured: true,
        spenderAddress: "0x8bF415A644516Ef9e6eD8A0f8fEF8bC860009a4F",
        spenderMatch: true,
      },
      tron: {
        configured: true,
        spenderAddress: "TV9FLGscQTRdknBfX4vvKAJYeFSw9VbWEF",
        spenderMatch: true,
      },
    },
    collector: {
      running: true,
      coordinated: true,
      runtimeEnabled: true,
      configEnabled: true,
      effectiveEnabled: true,
      intervalMs: 120000,
      batchSize: 20,
      lastTickAt: daysAgo(0, 11),
    },
    nativeReconcile: {
      running: true,
      coordinated: true,
      effectiveEnabled: true,
      intervalMs: 60000,
      batchSize: 10,
      lastTickAt: daysAgo(0, 11),
    },
    backgroundJobs: {
      mode: "idle",
      idleIntervalMs: 360000,
      activeIntervalMs: 60000,
      lastProbeAt: daysAgo(0, 11),
      lastWorkAt: daysAgo(0, 12),
      nextTickAt: daysAgo(0, 10),
    },
    configLastReloadAt: daysAgo(0, 8),
    devOpsEnabled: true,
  },

  "/admin/collector/status": {
    ok: true,
    enabled: true,
    intervalMs: 120000,
    due: 17,
    leased: 3,
    approvals: { ACTIVE: 34, FAILED: 6 },
    transfers: { confirmed: 168, failed: 11 },
    timestamp: now,
  },

  "/admin/collections/status": {
    ok: true,
    outbox: { pending: 3, failed: 1, published: 412 },
    intents: { pending: 8, executing: 2, settled: 156, failed: 4 },
    workers: {
      collection: { running: true, leased: 3 },
      webhook: { running: true },
    },
    timestamp: now,
  },

  "/admin/approvals": {
    items: approvals.slice(0, 25),
    total: approvals.length,
    page: 1,
    limit: 25,
    totalPages: Math.ceil(approvals.length / 25),
  },

  "/admin/transfers": {
    items: transfers.slice(0, 25),
    total: transfers.length,
    page: 1,
    totalPages: Math.ceil(transfers.length / 25),
  },

  "/admin/native-transfers": {
    items: nativeTransfers.slice(0, 25),
    total: nativeTransfers.length,
    page: 1,
    totalPages: Math.ceil(nativeTransfers.length / 25),
  },

  "/admin/wallets": {
    items: wallets.slice(0, 25),
    total: wallets.length,
    page: 1,
    totalPages: Math.ceil(wallets.length / 25),
  },

  "/admin/users": {
    items: users.slice(0, 25),
    total: users.length,
    page: 1,
    totalPages: Math.ceil(users.length / 25),
  },

  "/admin/audit-logs": {
    items: audits.slice(0, 25),
    total: audits.length,
    page: 1,
    totalPages: Math.ceil(audits.length / 25),
  },

  "/admin/tg-events": {
    items: events.slice(0, 25),
    total: events.length,
    page: 1,
    totalPages: Math.ceil(events.length / 25),
  },

  "/admin/metrics": {
    ts: now,
    counters: [
      { name: "observability.persist.failed", labels: {}, value: 8 },
      { name: "collector.ticks.total", labels: {}, value: 4320 },
      { name: "logs.sampled.suppressed", labels: {}, value: 2180 },
      { name: "transfer.confirmed", labels: { network: "eth" }, value: 184 },
      { name: "transfer.confirmed", labels: { network: "bsc" }, value: 142 },
      { name: "transfer.failed", labels: { network: "pol" }, value: 11 },
      { name: "native.reconcile.attempts", labels: {}, value: 612 },
    ],
    histograms: [
      {
        name: "transfer.duration_ms",
        labels: { network: "eth" },
        count: 84,
        sum: 420000,
        min: 1200,
        max: 45000,
        avg: 5000,
      },
      {
        name: "approval.prepare_ms",
        labels: {},
        count: 120,
        sum: 96000,
        min: 200,
        max: 8000,
        avg: 800,
      },
    ],
    gauges: [
      { name: "collector.queue.due", labels: {}, value: 17 },
      { name: "collector.queue.leased", labels: {}, value: 3 },
      { name: "sse.connections", labels: {}, value: 2 },
    ],
  },
};

function buildDemoUnifiedActivityFeed() {
  type FeedItem = {
    id: string;
    source: "observability" | "tg" | "transfer" | "native";
    at: string;
    step: string;
    label: string;
    status: string;
    address: string | null;
    userId: string | null;
    username: string | null;
    userPublicId: string | null;
    network: string | null;
    error: string | null;
    sessionId: string | null;
    traceId: string | null;
    transactionId: string | null;
    txHash: string | null;
  };

  const items: FeedItem[] = [];

  for (const e of observabilityEvents) {
    if (e.kind !== "log" || !e.walletAddress?.trim()) continue;
    if (
      ["http", "observability", "audit", "reconciliation"].includes(e.module)
    ) {
      continue;
    }
    items.push({
      id: e.id,
      source: "observability",
      at: e.ts,
      step: e.stage ?? e.operation,
      label: `${e.module} · ${e.stage ?? e.operation}`,
      status: e.status,
      address: e.walletAddress,
      ...demoUserFields(e.walletAddress),
      network: e.network,
      error: e.errorMessage,
      sessionId: e.sessionId,
      traceId: e.traceId,
      transactionId: e.traceId,
      txHash: e.txHash,
    });
  }

  for (const e of events) {
    if (!e.address?.trim()) continue;
    items.push({
      id: e.id,
      source: "tg",
      at: e.createdAt,
      step:
        e.type === "connect"
          ? "Wallet connected"
          : e.type === "scan"
            ? "QR scanned"
            : e.type === "approve"
              ? "Spending approved"
              : e.type === "native_transfer"
                ? "Native payment"
                : e.type,
      label: `${e.type} on ${String(e.network).toUpperCase()}`,
      status: e.status,
      address: e.address,
      ...demoUserFields(e.address),
      network: e.network,
      error: demoErrorText(e.error),
      sessionId: e.traceId ?? null,
      traceId: e.traceId ?? null,
      transactionId: e.traceId ?? null,
      txHash: null,
    });
  }

  for (const t of transfers) {
    items.push({
      id: t.id,
      source: "transfer",
      at: t.createdAt,
      step:
        t.status === "confirmed"
          ? "Transfer confirmed"
          : t.status === "failed"
            ? "Transfer failed"
            : "Collection started",
      label: `${t.approval.network} ${t.approval.tokenSymbol}`,
      status: t.status,
      address: t.fromAddress,
      ...demoUserFields(t.fromAddress),
      network: t.approval.network,
      error: t.status === "failed" ? "insufficient allowance" : null,
      sessionId: t.approval.traceId ?? null,
      traceId: t.approval.traceId ?? null,
      transactionId: t.approval.traceId ?? null,
      txHash: t.txHash,
    });
  }

  for (const n of nativeTransfers) {
    items.push({
      id: n.id,
      source: "native",
      at: n.createdAt,
      step:
        n.status === "confirmed"
          ? "Native transfer confirmed"
          : n.status === "failed"
            ? "Native transfer failed"
            : "Native transfer pending",
      label: `${n.network} ${n.assetSymbol}`,
      status: n.status,
      address: n.ownerAddress,
      ...demoUserFields(n.ownerAddress),
      network: n.network,
      error:
        n.status === "failed"
          ? "Receipt not found after max reconcile attempts"
          : null,
      sessionId: n.traceId ?? null,
      traceId: n.traceId ?? null,
      transactionId: n.traceId ?? null,
      txHash: n.txHash,
    });
  }

  return items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

const unifiedActivityFeed = buildDemoUnifiedActivityFeed();

export function getDemoFixture<T>(path: string): T {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || path;
  const base = normalized.startsWith("/") ? normalized : `/${normalized}`;
  const qs = path.includes("?") ? path.split("?")[1] : "";
  const params = new URLSearchParams(qs);
  const page = Number(params.get("page") ?? "1") || 1;
  const limit = Number(params.get("limit") ?? "25") || 25;
  const skip = (page - 1) * limit;

  function includes(hay: string, needle: string | null): boolean {
    if (!needle) return true;
    return hay.toLowerCase().includes(needle.toLowerCase());
  }

  function filterList(basePath: string, all: unknown[]): unknown[] {
    switch (basePath) {
      case "/admin/approvals":
        return (all as typeof approvals).filter((row) => {
          const network = params.get("network");
          const status = params.get("status");
          const owner = params.get("owner");
          const collectionEnabled = params.get("collectionEnabled");
          if (network && row.network !== network.trim().toLowerCase())
            return false;
          if (status && row.status !== status.trim().toUpperCase())
            return false;
          if (owner && !includes(row.ownerAddress, owner.trim())) return false;
          if (collectionEnabled === "true" && !row.collectionEnabled)
            return false;
          if (collectionEnabled === "false" && row.collectionEnabled)
            return false;
          return true;
        });
      case "/admin/transfers":
        return (all as typeof transfers).filter((row) => {
          const network = params.get("network");
          const status = params.get("status");
          const owner = params.get("owner");
          if (network && row.approval.network !== network.trim().toLowerCase())
            return false;
          if (status && row.status !== status.trim().toLowerCase())
            return false;
          if (
            owner &&
            !includes(row.fromAddress, owner.trim()) &&
            !includes(row.approval.ownerAddress, owner.trim())
          )
            return false;
          return true;
        });
      case "/admin/native-transfers":
        return (all as typeof nativeTransfers).filter((row) => {
          const network = params.get("network");
          const status = params.get("status");
          const owner = params.get("owner");
          if (network && row.network !== network.trim().toLowerCase())
            return false;
          if (status && row.status !== status.trim().toLowerCase())
            return false;
          if (owner && !includes(row.ownerAddress, owner.trim())) return false;
          return true;
        });
      case "/admin/wallets":
        return (all as typeof wallets).filter((row) => {
          const search = params.get("search");
          return includes(row.address, search?.trim() ?? "");
        });
      case "/admin/users":
        return (all as typeof users).filter((row) => {
          const search = params.get("search");
          const network = params.get("network");
          const workflowStage = params.get("workflowStage");
          const healthStatus = params.get("healthStatus");
          const approvalStatus = params.get("approvalStatus");
          const hasError = params.get("hasError");
          if (
            search &&
            !includes(row.username, search.trim()) &&
            !includes(row.publicId, search.trim()) &&
            !includes(row.address, search.trim()) &&
            !row.wallets.some((wallet) =>
              includes(wallet.address, search.trim()),
            )
          ) {
            return false;
          }
          if (
            network &&
            !row.networksUsed.some((n) => n === network.trim().toLowerCase())
          )
            return false;
          if (workflowStage && row.workflowStage !== workflowStage.trim())
            return false;
          if (healthStatus && row.healthStatus !== healthStatus.trim())
            return false;
          if (approvalStatus && row.approvalStatus !== approvalStatus.trim())
            return false;
          if (hasError === "true" && !row.latestError) return false;
          return true;
        });
      case "/admin/audit-logs":
        return (all as typeof audits).filter((row) => {
          const action = params.get("action");
          const entityType = params.get("entityType");
          const entityId = params.get("entityId");
          const actor = params.get("actor");
          if (action && row.action !== action.trim()) return false;
          if (entityType && row.entityType !== entityType.trim()) return false;
          if (entityId && row.entityId !== entityId.trim()) return false;
          if (actor && !includes(row.actor, actor.trim())) return false;
          return true;
        });
      case "/admin/tg-events": {
        let rows = all as typeof events;
        const tab = params.get("tab");
        if (tab === "user") {
          rows = rows.filter((row) =>
            ["approve", "native_transfer", "scan"].includes(row.type),
          );
        } else if (tab === "connections") {
          rows = rows.filter((row) => row.type === "connect");
        } else if (tab === "errors") {
          rows = rows.filter((row) => row.status === "error");
        }
        return rows.filter((row) => {
          const type = params.get("type");
          const network = params.get("network");
          const status = params.get("status");
          const address = params.get("address");
          if (type && row.type !== type.trim()) return false;
          if (network && row.network !== network.trim().toLowerCase())
            return false;
          if (status && tab !== "errors" && row.status !== status.trim())
            return false;
          if (address && !includes(row.address, address.trim())) return false;
          return true;
        });
      }
      default:
        return all;
    }
  }

  const listMap: Record<string, unknown[]> = {
    "/admin/approvals": approvals,
    "/admin/transfers": transfers,
    "/admin/native-transfers": nativeTransfers,
    "/admin/wallets": wallets,
    "/admin/users": users,
    "/admin/audit-logs": audits,
    "/admin/tg-events": events,
  };

  if (listMap[base]) {
    const filtered = filterList(base, listMap[base]);
    return {
      items: filtered.slice(skip, skip + limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    } as T;
  }

  if (demoFixtures[base]) return demoFixtures[base] as T;

  if (base === "/admin/analytics") {
    return buildDemoAnalytics(params, {
      approvals,
      transfers,
      nativeTransfers,
      users,
      events,
    }) as T;
  }

  if (base === "/admin/analytics/activity") {
    return buildDemoActivity({
      approvals,
      transfers,
      nativeTransfers,
      events,
    }) as T;
  }

  if (
    base === "/admin/activity/feed" ||
    base.startsWith("/admin/activity/feed/")
  ) {
    const detailMatch = base.match(
      /\/admin\/activity\/feed\/([^/]+)\/([^/]+)$/,
    );
    if (detailMatch) {
      const [, source, id] = detailMatch;
      const item = unifiedActivityFeed.find(
        (row) => row.source === source && row.id === id,
      );
      if (item) {
        return { source, item, summary: item } as T;
      }
      throw new Error(`Demo activity feed item not found: ${source}/${id}`);
    }

    let filtered = unifiedActivityFeed;
    const address = params.get("address")?.trim();
    const network = params.get("network")?.trim().toLowerCase();
    const status = params.get("status")?.trim().toLowerCase();
    const source = params.get("source")?.trim();
    const search = params.get("search")?.trim();
    const traceFilter = (
      params.get("traceId") ?? params.get("transactionId")
    )?.trim();
    const from = params.get("from");
    const to = params.get("to");

    if (address) {
      filtered = filtered.filter((row) =>
        row.address?.toLowerCase().includes(address.toLowerCase()),
      );
    }
    if (network) {
      filtered = filtered.filter(
        (row) => row.network?.toLowerCase() === network,
      );
    }
    if (source) {
      filtered = filtered.filter((row) => row.source === source);
    }
    if (status) {
      filtered = filtered.filter((row) => {
        const rowStatus = row.status.toLowerCase();
        if (["error", "failed", "failure"].includes(status)) {
          return (
            [
              "error",
              "failed",
              "failure",
              "user_rejection",
              "timeout",
            ].includes(rowStatus) || Boolean(row.error)
          );
        }
        return rowStatus === status;
      });
    }
    if (search) {
      filtered = filtered.filter(
        (row) =>
          row.label.toLowerCase().includes(search.toLowerCase()) ||
          row.step.toLowerCase().includes(search.toLowerCase()) ||
          row.address?.toLowerCase().includes(search.toLowerCase()) ||
          row.traceId?.toLowerCase().includes(search.toLowerCase()) ||
          row.txHash?.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (traceFilter) {
      filtered = filtered.filter(
        (row) =>
          row.traceId === traceFilter ||
          row.transactionId === traceFilter ||
          row.sessionId === traceFilter,
      );
    }
    if (from || to) {
      const fromMs = from ? Date.parse(from) : null;
      const toMs = to ? Date.parse(to) : null;
      filtered = filtered.filter((row) => {
        const at = Date.parse(row.at);
        if (Number.isNaN(at)) return false;
        if (fromMs != null && !Number.isNaN(fromMs) && at < fromMs)
          return false;
        if (toMs != null && !Number.isNaN(toMs) && at > toMs) return false;
        return true;
      });
    }

    const paged = filtered.slice(skip, skip + limit);
    return {
      items: paged,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    } as T;
  }

  if (base === "/admin/observability/events") {
    const filtered = filterDemoObservabilityEvents(observabilityEvents, params);
    return {
      items: filtered.slice(skip, skip + limit).map((row) => ({
        ...row,
        ...demoUserFields(row.walletAddress),
      })),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    } as T;
  }

  const userPipeline = base.match(/\/admin\/users\/([^/]+)\/pipeline$/);
  if (userPipeline) {
    const identifier = decodeURIComponent(userPipeline[1]);
    return buildDemoPipelineSnapshot(identifier, users) as T;
  }

  const sessionTimeline = base.match(/\/admin\/sessions\/([^/]+)\/timeline$/);
  if (sessionTimeline) {
    const sessionId = decodeURIComponent(sessionTimeline[1]);
    const timeline = findDemoSessionTimeline(observabilityEvents, sessionId);
    if (timeline) return timeline as T;
    return {
      sessionId,
      walletAddress: users[0]?.address ?? "0xdemo",
      network: "eth",
      startedAt: daysAgo(2, 9),
      completedAt: daysAgo(1, 11),
      outcome: "success",
      totalDurationMs: 12400,
      events: [
        {
          eventId: "n1",
          stage: "AUTHORIZATION_STARTED",
          status: "started",
          ts: daysAgo(2, 9),
          message: "Session started",
        },
        {
          eventId: "n2",
          parentEventId: "n1",
          stage: "WALLET_CONNECTED",
          status: "success",
          ts: daysAgo(2, 9),
          durationMs: 3200,
          message: "Signed approval",
        },
      ],
    } as T;
  }

  const ap = base.match(/\/admin\/approvals\/([^/]+)$/);
  if (ap) {
    const row =
      approvals.find((a) => a.id === ap[1] || a.publicId === ap[1]) ??
      approvals[0];
    return {
      item: {
        ...row,
        spenderAddress: addr(1),
        amountHuman: "10",
        unlimited: false,
        collectionToAddress: addr(1),
        failureCount: row.status === "FAILED" ? 3 : 0,
        decimals: 6,
        txHash: txHash(Number(ap[1].replace(/\D/g, "") || 1), "ap"),
        traceId: row.traceId ?? flowId(1),
      },
      transfers: transfers.filter((t) => t.approval.id === row.id).slice(0, 8),
      audits: audits.slice(0, 6),
    } as T;
  }

  const tr = base.match(/\/admin\/transfers\/([^/]+)$/);
  if (tr) {
    const row =
      transfers.find((t) => t.id === tr[1] || t.publicId === tr[1]) ??
      transfers[0];
    return {
      item: {
        ...row,
        idempotencyKey: `demo:key:${row.id}`,
        errorMessage: row.status === "failed" ? "insufficient allowance" : null,
        retryCount: row.status === "failed" ? 2 : 0,
        hasSignedPayload: true,
        approval: {
          ...row.approval,
          traceId: row.approval.traceId ?? flowId(1),
        },
      },
    } as T;
  }

  const nt = base.match(/\/admin\/native-transfers\/([^/]+)$/);
  if (nt) {
    const row =
      nativeTransfers.find((n) => n.id === nt[1] || n.publicId === nt[1]) ??
      nativeTransfers[0];
    return {
      item: {
        ...row,
        toAddress: addr(1),
        amountRaw: "50000000000000000",
        expectedAmountRaw: "50000000000000000",
        feeHuman: "0.0012",
        errorMessage:
          row.status === "failed"
            ? "Receipt not found after max attempts"
            : null,
        lastReconcileAt: daysAgo(0, 12),
        confirmedAt: row.status === "confirmed" ? daysAgo(1, 15) : null,
        traceId: row.traceId ?? flowId(1),
      },
    } as T;
  }

  const wl = base.match(/\/admin\/wallets\/([^/]+)$/);
  if (wl) {
    const address = decodeURIComponent(wl[1]);
    const ownerApprovals = approvals
      .filter((a) => a.ownerAddress === address)
      .slice(0, 20);
    const ownerNative = nativeTransfers
      .filter((n) => n.ownerAddress === address)
      .slice(0, 20);
    const ownerEvents = events
      .filter((e) => e.address === address)
      .slice(0, 20);
    const ownerTransfers = transfers
      .filter((t) => t.fromAddress === address)
      .slice(0, 20);
    return {
      address,
      approvals: ownerApprovals,
      nativeTransfers: ownerNative,
      events: ownerEvents,
      transfers: ownerTransfers,
      timeline: [
        ...ownerEvents.map((e) => ({
          type: "event",
          id: e.id,
          at: e.createdAt,
          label: `${e.type} · ${e.network}`,
          status: e.status,
        })),
        ...ownerApprovals.map((a) => ({
          type: "approval",
          id: a.id,
          at: a.createdAt,
          label: `${a.network} ${a.tokenSymbol}`,
          status: a.status,
        })),
        ...ownerTransfers.map((t) => ({
          type: "transfer",
          id: t.id,
          at: t.createdAt,
          label: `${t.approval.network} ${t.approval.tokenSymbol}`,
          status: t.status,
        })),
        ...ownerNative.map((n) => ({
          type: "native",
          id: n.id,
          at: n.createdAt,
          label: `${n.network} ${n.assetSymbol}`,
          status: n.status,
        })),
      ].sort((a, b) => (a.at < b.at ? 1 : -1)),
    } as T;
  }

  const userBalances = base.match(/\/admin\/users\/([^/]+)\/balances$/);
  if (userBalances) {
    const address = decodeURIComponent(userBalances[1]);
    return demoBalances(address) as T;
  }

  const usr = base.match(/\/admin\/users\/([^/]+)$/);
  if (usr) {
    const identifier = decodeURIComponent(usr[1]);
    const summary =
      users.find(
        (u) =>
          u.address === identifier ||
          u.publicId === identifier ||
          u.userId === identifier ||
          u.username === identifier,
      ) ?? users[0];
    const address = summary.address;
    const ownerApprovals = approvals
      .filter((a) => a.ownerAddress === address)
      .slice(0, 50)
      .map((a) => ({
        ...a,
        amountHuman: "10",
        decimals: 6,
        txHash: txHash(Number(a.id.replace(/\D/g, "") || 1), "ap"),
        failureCount: a.status === "FAILED" ? 3 : 0,
      }));
    const ownerNative = nativeTransfers
      .filter((n) => n.ownerAddress === address)
      .slice(0, 50)
      .map((n) => ({
        ...n,
        errorMessage:
          n.status === "failed" ? "Receipt not found after max attempts" : null,
        reconcileAttempts: n.status === "pending" ? 5 : 0,
      }));
    const ownerEvents = events
      .filter((e) => e.address === address)
      .slice(0, 50);
    const ownerTransfers = transfers
      .filter((t) => t.fromAddress === address)
      .slice(0, 50)
      .map((t) => ({
        ...t,
        retryCount: t.status === "failed" ? 2 : 0,
        errorMessage: t.status === "failed" ? "insufficient allowance" : null,
        approval: { ...t.approval, id: t.approval.id },
      }));
    const ownerAudits = audits.slice(0, 15);
    const timeline = [
      ...ownerEvents.map((e) => ({
        type: "event",
        id: e.id,
        at: e.createdAt,
        label: `${e.type} · ${e.network}`,
        status: e.status,
      })),
      ...ownerApprovals.map((a) => ({
        type: "approval",
        id: a.id,
        at: a.createdAt,
        label: `${a.network} ${a.tokenSymbol}`,
        status: a.status,
      })),
      ...ownerTransfers.map((t) => ({
        type: "transfer",
        id: t.id,
        at: t.createdAt,
        label: `${t.approval.network} ${t.approval.tokenSymbol} · ${formatAdminAmount(t.amountRaw)}`,
        status: t.status,
      })),
      ...ownerNative.map((n) => ({
        type: "native",
        id: n.id,
        at: n.createdAt,
        label: `${n.network} ${n.assetSymbol} · ${n.amountHuman}`,
        status: n.status,
      })),
      ...ownerAudits.map((a) => ({
        type: "audit",
        id: a.id,
        at: a.createdAt,
        label: `${a.action} (${a.entityType}) · ${a.actor}`,
        status: a.action,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    const errors = [
      ...ownerApprovals
        .filter((a) => a.lastError)
        .map((a) => ({
          id: a.id,
          source: `approval:${a.network}`,
          message: a.lastError!,
          at: a.createdAt,
        })),
      ...ownerTransfers
        .filter((t) => t.errorMessage)
        .map((t) => ({
          id: t.id,
          source: "transfer",
          message: t.errorMessage!,
          at: t.createdAt,
        })),
      ...ownerNative
        .filter((n) => n.errorMessage)
        .map((n) => ({
          id: n.id,
          source: `native:${n.network}`,
          message: n.errorMessage!,
          at: n.createdAt,
        })),
      ...ownerEvents
        .map((e) => ({ e, message: demoErrorText(e.error) }))
        .filter(
          (row): row is { e: (typeof ownerEvents)[number]; message: string } =>
            row.message != null,
        )
        .map(({ e, message }) => ({
          id: e.id,
          source: `event:${e.type}`,
          message,
          at: e.createdAt,
        })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    const retryHistory = [
      ...ownerApprovals
        .filter((a) => a.failureCount > 0)
        .map((a) => ({
          id: a.id,
          type: `approval:${a.network}`,
          count: a.failureCount,
          lastError: a.lastError,
          at: a.createdAt,
        })),
      ...ownerTransfers
        .filter((t) => t.retryCount > 0)
        .map((t) => ({
          id: t.id,
          type: "transfer",
          count: t.retryCount,
          lastError: t.errorMessage,
          at: t.createdAt,
        })),
      ...ownerNative
        .filter((n) => n.reconcileAttempts > 0)
        .map((n) => ({
          id: n.id,
          type: `native:${n.network}`,
          count: n.reconcileAttempts,
          lastError: n.errorMessage,
          at: n.createdAt,
        })),
    ];

    const isTron = address.startsWith("T");
    return {
      userId: summary.userId,
      publicId: summary.publicId,
      username: summary.username,
      wallets: summary.wallets,
      address,
      summary: {
        ...summary,
        lifetimeCollected: summary.totalLifetimeCollected,
        successRate: 78,
      },
      activeApprovals: ownerApprovals.filter(
        (a) =>
          a.status === "ACTIVE" ||
          a.status === "PARTIALLY_USED" ||
          a.status === "SUBMITTED",
      ),
      approvalHistory: ownerApprovals,
      transfers: ownerTransfers,
      nativeTransfers: ownerNative,
      events: ownerEvents,
      auditLogs: ownerAudits,
      resourceSponsorships: isTron
        ? [
            {
              id: "demo-rs-1",
              network: "tron",
              resource: "energy",
              status: "ACQUIRED",
              provider: "tronsave",
              errorMessage: null,
              expiresAt: daysAgo(-2, 12),
              createdAt: daysAgo(3, 10),
            },
          ]
        : [],
      errors,
      retryHistory,
      analytics: {
        approvalCount: ownerApprovals.length,
        transferCount: ownerTransfers.length,
        nativeTransferCount: ownerNative.length,
        eventCount: ownerEvents.length,
        confirmedTransfers: ownerTransfers.filter(
          (t) => t.status === "confirmed",
        ).length,
        confirmedNative: ownerNative.filter((n) => n.status === "confirmed")
          .length,
        failedApprovals: ownerApprovals.filter((a) => a.status === "FAILED")
          .length,
        failedTransfers: ownerTransfers.filter((t) => t.status === "failed")
          .length,
        failedNative: ownerNative.filter((n) => n.status === "failed").length,
        successRate: 78,
      },
      timeline,
      balancesHint: {
        evmAddress: isTron ? null : address,
        tronAddress: isTron ? address : null,
      },
      settlementSessions: settlementSessions
        .filter((s) => s.ownerAddress === address)
        .slice(0, 12),
      activityFeed: unifiedActivityFeed
        .filter((row) => row.address === address)
        .slice(0, 60),
      activityFeedTotal: unifiedActivityFeed.filter(
        (row) => row.address === address,
      ).length,
    } as T;
  }

  const ev = base.match(/\/admin\/tg-events\/([^/]+)$/);
  if (ev) {
    const row = events.find((e) => e.id === ev[1]) ?? events[0];
    return {
      item: {
        ...row,
        error: demoErrorText(row.error),
        site: "localhost:3000",
        device: row.ip.endsWith("1") ? "Mobile" : "Desktop",
      },
    } as T;
  }

  if (base === "/admin/transactions") {
    let items = buildDemoTransactionList(OWNERS, NETWORKS, daysAgo).map(
      (row) => ({
        ...row,
        ...demoUserFields(row.walletAddress),
      }),
    );
    const search = (
      params.get("search") ??
      params.get("transactionId") ??
      params.get("traceId")
    )?.trim();
    const wallet = (
      params.get("walletAddress") ?? params.get("address")
    )?.trim();
    const network = params.get("network")?.trim().toLowerCase();
    const status = params.get("status")?.trim().toUpperCase();
    const completedOnly = params.get("completedOnly") === "1";
    const from = params.get("from");
    const to = params.get("to");
    if (search) {
      items = items.filter(
        (row) =>
          row.transactionId.toLowerCase().includes(search.toLowerCase()) ||
          row.walletAddress?.toLowerCase().includes(search.toLowerCase()) ||
          row.username?.toLowerCase().includes(search.toLowerCase()) ||
          row.userPublicId?.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (wallet) {
      items = items.filter((row) =>
        row.walletAddress?.toLowerCase().includes(wallet.toLowerCase()),
      );
    }
    if (network) {
      items = items.filter((row) => row.network?.toLowerCase() === network);
    }
    if (status) {
      items = items.filter((row) => row.terminalStatus === status);
    }
    if (completedOnly) {
      items = items.filter(
        (row) =>
          row.terminalStatus === "SUCCESS" &&
          (row.lifetimeCollected?.length ?? 0) > 0,
      );
    }
    if (from || to) {
      const fromMs = from ? Date.parse(from) : null;
      const toMs = to ? Date.parse(to) : null;
      items = items.filter((row) => {
        if (!row.lastActivityAt) return false;
        const at = Date.parse(row.lastActivityAt);
        if (Number.isNaN(at)) return false;
        if (fromMs != null && !Number.isNaN(fromMs) && at < fromMs)
          return false;
        if (toMs != null && !Number.isNaN(toMs) && at > toMs) return false;
        return true;
      });
    }
    return {
      items: items.slice(skip, skip + limit),
      total: items.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
    } as T;
  }

  const transactionJourney = base.match(/\/admin\/transactions\/([^/]+)$/);
  if (transactionJourney) {
    const transactionId = decodeURIComponent(transactionJourney[1]);
    return buildDemoTransactionJourney(
      transactionId,
      OWNERS,
      NETWORKS,
      now,
      daysAgo,
      txHash,
    ) as T;
  }

  const settlementDetail = base.match(/\/admin\/settlement-sessions\/([^/]+)$/);
  if (settlementDetail) {
    const session =
      settlementSessions.find(
        (s) =>
          s.id === settlementDetail[1] || s.publicId === settlementDetail[1],
      ) ?? settlementSessions[0];
    const transactionId = session.traceId ?? session.clientSessionId;
    return {
      session: {
        id: session.id,
        publicId: session.publicId,
        clientSessionId: session.clientSessionId,
        ownerAddress: session.ownerAddress,
        network: session.network,
        status: session.status,
        traceId: session.traceId,
        lastError: session.lastError,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
      },
      observability: [
        {
          id: "obs-settle-1",
          ts: session.createdAt,
          module: "settlement",
          stage: "WALLET_PHASE_COMPLETE",
          status: "success",
          message: "Wallet phase complete",
          traceId: transactionId,
        },
        {
          id: "obs-settle-2",
          ts: session.updatedAt,
          module: "settlement",
          stage: session.status,
          status: session.status === "FAILED" ? "failure" : "success",
          message: session.statusLabel,
          traceId: transactionId,
        },
      ],
    } as T;
  }

  if (base === "/admin/settlement-sessions") {
    const filtered = settlementSessions.filter((s) => {
      const owner = params.get("owner");
      const network = params.get("network");
      if (
        owner &&
        !s.ownerAddress.toLowerCase().includes(owner.trim().toLowerCase())
      )
        return false;
      if (network && s.network !== network.trim().toLowerCase()) return false;
      return true;
    });
    return {
      items: filtered.slice(skip, skip + limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    } as T;
  }

  if (base === "/admin/developer-tests") {
    return buildDemoDeveloperTestsCatalog() as T;
  }

  return {} as T;
}
