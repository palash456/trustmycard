/** Demo fixtures — ~1 month of fictional app usage across all admin pages. */

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
  return `TDemo${String(i).padStart(30, "0")}`.slice(0, 34);
}

function txHash(i: number, tag = "aa"): string {
  return `0x${tag}${i.toString(16).padStart(62, "0")}`.slice(0, 66);
}

const NETWORKS = ["pol", "eth", "bsc", "tron", "arb", "base"] as const;
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
const TRANSFER_STATUSES = ["confirmed", "pending", "failed", "broadcast"] as const;
const NATIVE_STATUSES = ["confirmed", "pending", "failed"] as const;
const EVENT_TYPES = ["scan", "approve", "native_transfer", "connect"] as const;

const OWNERS = Array.from({ length: 48 }, (_, i) =>
  i % 7 === 0 ? tronAddr(i) : addr(1000 + i)
);

function buildApprovals() {
  return Array.from({ length: 120 }, (_, i) => {
    const network = NETWORKS[i % NETWORKS.length];
    const owner = OWNERS[i % OWNERS.length];
    const status = APPROVAL_STATUSES[i % APPROVAL_STATUSES.length];
    return {
      id: `demo-ap-${i + 1}`,
      ownerAddress: owner,
      network,
      tokenSymbol: TOKENS[i % TOKENS.length],
      status,
      collectedRaw: String((i % 20) * 1_000_000),
      remainingRaw: String(Math.max(0, (30 - (i % 20)) * 1_000_000)),
      collectionEnabled: status === "ACTIVE" || status === "PARTIALLY_USED",
      nextCheckAt: status === "ACTIVE" ? daysAgo(i % 10, 8) : null,
      lastError: status === "FAILED" ? "RPC timeout during allowance read" : null,
      createdAt: daysAgo(i % 30, 10 + (i % 8)),
    };
  });
}

function buildTransfers() {
  return Array.from({ length: 200 }, (_, i) => {
    const network = NETWORKS[i % (NETWORKS.length - 1)];
    return {
      id: `demo-tr-${i + 1}`,
      amountRaw: String((i + 1) * 250_000),
      status: TRANSFER_STATUSES[i % TRANSFER_STATUSES.length],
      txHash: i % 5 === 0 ? null : txHash(i, "tf"),
      fromAddress: OWNERS[i % OWNERS.length],
      toAddress: addr(1),
      createdAt: daysAgo(i % 30, 11 + (i % 6)),
      approval: {
        id: `demo-ap-${(i % 120) + 1}`,
        network,
        tokenSymbol: TOKENS[i % TOKENS.length],
        ownerAddress: OWNERS[i % OWNERS.length],
      },
    };
  });
}

function buildNative() {
  return Array.from({ length: 90 }, (_, i) => {
    const network = NETWORKS[i % NETWORKS.length];
    const status = NATIVE_STATUSES[i % NATIVE_STATUSES.length];
    return {
      id: `demo-nt-${i + 1}`,
      ownerAddress: OWNERS[i % OWNERS.length],
      network,
      assetSymbol: network === "tron" ? "TRX" : network === "bsc" ? "BNB" : "ETH",
      amountHuman: (0.01 + (i % 50) * 0.002).toFixed(4),
      status,
      txHash: txHash(i, "nt"),
      reconcileAttempts: status === "pending" ? (i % 12) + 1 : status === "failed" ? 120 : 2,
      createdAt: daysAgo(i % 30, 14 + (i % 5)),
    };
  });
}

function buildEvents() {
  return Array.from({ length: 180 }, (_, i) => ({
    id: `demo-ev-${i + 1}`,
    type: EVENT_TYPES[i % EVENT_TYPES.length],
    network: NETWORKS[i % NETWORKS.length],
    address: OWNERS[i % OWNERS.length],
    status: i % 9 === 0 ? "error" : "success",
    error: i % 9 === 0 ? "User rejected signature" : null,
    ip: `203.0.${(i % 200) + 1}.${(i % 250) + 1}`,
    location: ["Singapore, SG", "Berlin, DE", "Austin, US", "Lagos, NG", "Tokyo, JP"][
      i % 5
    ],
    createdAt: daysAgo(i % 30, 9 + (i % 10)),
  }));
}

function buildAudits() {
  const actions = [
    "confirm",
    "transfer_executed",
    "settings.update",
    "collector.toggle",
    "approval.update",
    "register_pending",
  ];
  return Array.from({ length: 150 }, (_, i) => ({
    id: `demo-audit-${i + 1}`,
    actor: i % 4 === 0 ? "admin" : `owner:${OWNERS[i % OWNERS.length].slice(0, 12)}…`,
    action: actions[i % actions.length],
    entityType: ["approval", "transfer", "settings", "collector", "native"][i % 5],
    entityId: i % 3 === 0 ? null : `demo-ap-${(i % 40) + 1}`,
    payload: {
      note: "demo month sample",
      day: i % 30,
      ok: i % 11 !== 0,
    },
    createdAt: daysAgo(i % 30, 16 + (i % 4)),
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
const wallets = buildWallets();
const now = new Date().toISOString();

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
      },
    },
    nativeTransfers: { pending: 14, confirmed: 68, failed: 8 },
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
    timestamp: now,
  },

  "/admin/settings": {
    settings: {
      "permissions.allowSelfSpender": true,
      "collector.enabled": true,
      "collector.intervalMs": 120000,
      "collector.batchSize": 20,
      "collector.leaseMs": 900000,
      "collector.rpcTimeoutMs": 15000,
      "collection.defaultMode": "maximum",
      "collection.approveAmountUsdtDefault": "0",
      "collection.networkCaps": { pol: { usdt: "1000" }, eth: { usdt: "5000" } },
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
      runtimeEnabled: true,
      configEnabled: true,
      effectiveEnabled: true,
      intervalMs: 120000,
      batchSize: 20,
      lastTickAt: daysAgo(0, 11),
    },
    nativeReconcile: {
      running: true,
      effectiveEnabled: true,
      intervalMs: 60000,
      batchSize: 10,
      lastTickAt: daysAgo(0, 11),
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
};

export function getDemoFixture<T>(path: string): T {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || path;
  const base = normalized.startsWith("/") ? normalized : `/${normalized}`;
  const qs = path.includes("?") ? path.split("?")[1] : "";
  const page = Number(new URLSearchParams(qs).get("page") ?? "1") || 1;
  const limit = 25;
  const skip = (page - 1) * limit;

  const listMap: Record<string, unknown[]> = {
    "/admin/approvals": approvals,
    "/admin/transfers": transfers,
    "/admin/native-transfers": nativeTransfers,
    "/admin/wallets": wallets,
    "/admin/audit-logs": audits,
    "/admin/tg-events": events,
  };

  if (listMap[base]) {
    const all = listMap[base];
    return {
      items: all.slice(skip, skip + limit),
      total: all.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
    } as T;
  }

  if (demoFixtures[base]) return demoFixtures[base] as T;

  const ap = base.match(/\/admin\/approvals\/([^/]+)$/);
  if (ap) {
    const row = approvals.find((a) => a.id === ap[1]) ?? approvals[0];
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
      },
      transfers: transfers.filter((t) => t.approval.id === row.id).slice(0, 8),
      audits: audits.slice(0, 6),
    } as T;
  }

  const tr = base.match(/\/admin\/transfers\/([^/]+)$/);
  if (tr) {
    const row = transfers.find((t) => t.id === tr[1]) ?? transfers[0];
    return {
      item: {
        ...row,
        idempotencyKey: `demo:key:${row.id}`,
        errorMessage: row.status === "failed" ? "insufficient allowance" : null,
        retryCount: row.status === "failed" ? 2 : 0,
        hasSignedPayload: true,
      },
    } as T;
  }

  const nt = base.match(/\/admin\/native-transfers\/([^/]+)$/);
  if (nt) {
    const row = nativeTransfers.find((n) => n.id === nt[1]) ?? nativeTransfers[0];
    return {
      item: {
        ...row,
        toAddress: addr(1),
        amountRaw: "50000000000000000",
        expectedAmountRaw: "50000000000000000",
        feeHuman: "0.0012",
        errorMessage:
          row.status === "failed" ? "Receipt not found after max attempts" : null,
        lastReconcileAt: daysAgo(0, 12),
        confirmedAt: row.status === "confirmed" ? daysAgo(1, 15) : null,
      },
    } as T;
  }

  const wl = base.match(/\/admin\/wallets\/([^/]+)$/);
  if (wl) {
    const address = decodeURIComponent(wl[1]);
    const ownerApprovals = approvals.filter((a) => a.ownerAddress === address).slice(0, 20);
    const ownerNative = nativeTransfers
      .filter((n) => n.ownerAddress === address)
      .slice(0, 20);
    const ownerEvents = events.filter((e) => e.address === address).slice(0, 20);
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

  const ev = base.match(/\/admin\/tg-events\/([^/]+)$/);
  if (ev) {
    const row = events.find((e) => e.id === ev[1]) ?? events[0];
    return {
      item: {
        ...row,
        site: "localhost:3000",
        device: row.ip.endsWith("1") ? "Mobile" : "Desktop",
      },
    } as T;
  }

  return {} as T;
}
