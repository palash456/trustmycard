/** Synthetic structured logs — ~30 days, all modules/statuses/levels. */

import {
  TRANSACTION_TERMINAL_STAGES,
  type TransactionTerminalStatus,
} from "@trustmycard/shared/constants/transaction-lifecycle";
import type { LogLevel, LogStatus } from "@trustmycard/shared/observability";
import { demoTerminalStatusForFlowIndex, flowId } from "./traceability-fixture";

export type DemoObservabilityEvent = {
  id: string;
  kind: "log" | "timeline" | "timeline_node";
  ts: string;
  eventId: string;
  parentEventId?: string | null;
  sessionId: string | null;
  traceId: string | null;
  correlationId: string | null;
  walletAddress: string | null;
  chain: string | null;
  network: string | null;
  module: string;
  operation: string;
  stage: string | null;
  status: LogStatus | string;
  level: LogLevel | string | null;
  txHash: string | null;
  token: string | null;
  asset: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  message: string;
  payload: Record<string, unknown> | null;
};

const LOG_LEVELS: LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
];

const LOG_STATUSES: LogStatus[] = [
  "started",
  "in_progress",
  "success",
  "failure",
  "skipped",
  "retry",
  "timeout",
  "user_rejection",
  "validation_failure",
  "network_failure",
  "rpc_failure",
  "api_failure",
  "partial_success",
];

const SITES = [
  "pay.trustmycard.local",
  "checkout.demo.app",
  "merchant.example.com",
  "localhost:3000",
];

const CONNECT_STAGES = [
  "CONNECT STARTED",
  "QR DISPLAYED",
  "SCAN STARTED",
  "WALLET CONNECTED",
  "BALANCES FETCH SUCCESS",
  "CHECK_ELIGIBILITY_STARTED",
  "CHECK_ELIGIBILITY_FETCH_SUCCESS",
  "CHECK_ELIGIBILITY_COMPLETE",
  "NETWORK_REFRESH_SUCCESS",
  "ELIGIBILITY_GATE_BLOCKED",
  "APPROVAL SESSION STARTED",
  "WALLET PHASE COMPLETE — SETTLEMENT CONTINUES",
  "SETTLEMENT PROGRESS",
  "SETTLEMENT COMPLETE",
  TRANSACTION_TERMINAL_STAGES.SUCCESS,
  TRANSACTION_TERMINAL_STAGES.FAILED,
  TRANSACTION_TERMINAL_STAGES.CANCELLED,
  TRANSACTION_TERMINAL_STAGES.EXPIRED,
  "SETTLEMENT_FAILED",
  "APPROVAL SESSION FAILED",
] as const;

const WALLET_SERVICE_STAGES = [
  "APPROVAL PREPARE",
  "APPROVAL CONFIRM",
  "AUTO TRANSFER",
  "TRON BROADCAST",
  "FRONTEND FLOW",
  "TRANSFER RECONCILE",
  "RPC_RETRY",
  "RPC_FAILOVER",
] as const;

const SETTLEMENT_STAGES = [
  "WALLET_PHASE_COMPLETE",
  "TOKEN_SETTLED",
  "EXECUTING_NATIVE",
  "AWAITING_NATIVE",
  "COMPLETED",
  "FAILED",
] as const;

const INTERNAL_MODULES = [
  { module: "observability", operation: "persist", stage: "BACKGROUND_WRITE" },
  { module: "audit", operation: "write", stage: "AUDIT_PERSIST" },
  { module: "collector", operation: "tick", stage: "TICK_COMPLETED" },
  { module: "collector", operation: "tick", stage: "TICK_FAILED" },
  { module: "reconciliation", operation: "native", stage: "RECONCILE_FAILED" },
  { module: "http", operation: "request", stage: "INBOUND" },
] as const;

function journeyHour(day: number, slot: number): number {
  const weekday = day % 7;
  const isWeekend = weekday >= 5;
  const base = isWeekend ? 11 : 9;
  return base + (slot % (isWeekend ? 8 : 12));
}

function levelForStatus(status: LogStatus | string): LogLevel {
  if (
    status === "failure" ||
    status === "rpc_failure" ||
    status === "api_failure"
  ) {
    return "error";
  }
  if (
    status === "user_rejection" ||
    status === "timeout" ||
    status === "validation_failure" ||
    status === "network_failure"
  ) {
    return "warn";
  }
  if (status === "retry") return "debug";
  return "info";
}

function terminalStageForStatus(terminal: TransactionTerminalStatus): string {
  if (terminal === "SUCCESS") return TRANSACTION_TERMINAL_STAGES.SUCCESS;
  if (terminal === "FAILED") return TRANSACTION_TERMINAL_STAGES.FAILED;
  if (terminal === "CANCELLED") return TRANSACTION_TERMINAL_STAGES.CANCELLED;
  if (terminal === "EXPIRED") return TRANSACTION_TERMINAL_STAGES.EXPIRED;
  return "SETTLEMENT PROGRESS";
}

type JourneySpec = {
  day: number;
  slot: number;
  ownerIndex: number;
  networkIndex: number;
  flowSlot: number;
  terminal: TransactionTerminalStatus;
};

function buildJourneyLogs(
  spec: JourneySpec,
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
  txHash: (i: number, tag?: string) => string,
  seq: { n: number },
): DemoObservabilityEvent[] {
  const owner = owners[spec.ownerIndex % owners.length] ?? owners[0];
  const network = networks[spec.networkIndex % networks.length] ?? "eth";
  const trace = flowId(spec.flowSlot, owner);
  const hour = journeyHour(spec.day, spec.slot);
  const token = spec.slot % 2 === 0 ? "USDT" : "USDC";
  const asset = network === "tron" ? "TRX" : network === "bsc" ? "BNB" : "ETH";
  const terminal = spec.terminal;
  const events: DemoObservabilityEvent[] = [];

  const push = (
    partial: Partial<DemoObservabilityEvent> & {
      module: string;
      operation: string;
      status: LogStatus | string;
      message: string;
      ts: string;
    },
  ) => {
    seq.n += 1;
    const i = seq.n;
    events.push({
      kind: partial.kind ?? "log",
      id: `obs-demo-${i}`,
      eventId: partial.eventId ?? `evt-${i}`,
      parentEventId: partial.parentEventId ?? null,
      sessionId: partial.sessionId ?? trace,
      traceId: partial.traceId ?? trace,
      correlationId: partial.correlationId ?? trace,
      walletAddress: partial.walletAddress ?? owner,
      chain: partial.chain ?? network,
      network: partial.network ?? network,
      module: partial.module,
      operation: partial.operation,
      stage: partial.stage ?? null,
      status: partial.status,
      level: partial.level ?? levelForStatus(partial.status),
      txHash: partial.txHash ?? null,
      token: partial.token ?? null,
      asset: partial.asset ?? null,
      errorCode: partial.errorCode ?? null,
      errorMessage: partial.errorMessage ?? null,
      durationMs: partial.durationMs ?? null,
      message: partial.message,
      payload: partial.payload ?? null,
      ts: partial.ts,
    });
  };

  const t0 = daysAgo(spec.day, hour);
  const t1 = daysAgo(spec.day, hour);
  const t2 = daysAgo(spec.day, Math.min(23, hour + 1));

  push({
    ts: t0,
    module: "connect",
    operation: "connect_started",
    stage: "CONNECT STARTED",
    status: "started",
    message: "User opened connect flow",
    payload: { site: SITES[spec.day % SITES.length] },
  });

  push({
    ts: t0,
    module: "connect",
    operation: "qr_displayed",
    stage: "QR DISPLAYED",
    status: "in_progress",
    message: "Payment QR displayed",
  });

  push({
    ts: t0,
    module: "connect",
    operation: "scan",
    stage: "SCAN STARTED",
    status: "in_progress",
    message: "Wallet scan started",
  });

  push({
    ts: t1,
    module: "connect",
    operation: "wallet_connected",
    stage: "WALLET CONNECTED",
    status: "success",
    durationMs: 900 + (spec.slot % 400),
    message: "Wallet linked",
  });

  push({
    ts: t1,
    module: "connect",
    operation: "balances",
    stage: "BALANCES FETCH SUCCESS",
    status: "success",
    durationMs: 1200 + (spec.slot % 600),
    message: "Balances loaded",
    payload: { token, asset },
  });

  push({
    ts: t1,
    module: "connect",
    operation: "approval_session",
    stage: "APPROVAL SESSION STARTED",
    status: "started",
    message: "Approval session started",
    token,
  });

  push({
    ts: t1,
    module: "authorization",
    operation: "approval_prepare",
    stage: "APPROVAL PREPARE",
    status: "in_progress",
    message: "Preparing approval transaction",
    token,
  });

  if (terminal === "CANCELLED") {
    push({
      ts: t2,
      module: "connect",
      operation: "terminal",
      stage: TRANSACTION_TERMINAL_STAGES.CANCELLED,
      status: "user_rejection",
      level: "warn",
      message: "User cancelled before signing",
      errorCode: "USER_CANCELLED",
      errorMessage: "User rejected transaction",
    });
    return events;
  }

  if (terminal === "EXPIRED") {
    push({
      ts: t2,
      module: "connect",
      operation: "terminal",
      stage: TRANSACTION_TERMINAL_STAGES.EXPIRED,
      status: "timeout",
      level: "warn",
      message: "Session expired before completion",
      errorCode: "SESSION_EXPIRED",
    });
    return events;
  }

  const approvalFailed = terminal === "FAILED" && spec.slot % 3 === 0;
  push({
    ts: t2,
    module: "authorization",
    operation: "approval_confirm",
    stage: "APPROVAL CONFIRM",
    status: approvalFailed ? "user_rejection" : "success",
    level: approvalFailed ? "warn" : "info",
    message: approvalFailed ? "User rejected signature" : "Approval confirmed",
    token,
    txHash: approvalFailed ? null : txHash(seq.n, "ap"),
    errorMessage: approvalFailed ? "User rejected transaction" : null,
    errorCode: approvalFailed ? "ACTION_REJECTED" : null,
    durationMs: 2400 + (spec.slot % 800),
  });

  if (approvalFailed) {
    push({
      ts: t2,
      module: "connect",
      operation: "approval_session",
      stage: "APPROVAL SESSION FAILED",
      status: "failure",
      level: "error",
      message: "Approval session failed at sign step",
      errorMessage: "User rejected transaction",
    });
    push({
      ts: t2,
      module: "connect",
      operation: "terminal",
      stage: TRANSACTION_TERMINAL_STAGES.FAILED,
      status: "failure",
      level: "error",
      message: "Journey failed",
    });
    return events;
  }

  if (terminal === "IN_PROGRESS") {
    push({
      ts: t2,
      module: "settlement",
      operation: "settlement_progress",
      stage: "SETTLEMENT PROGRESS",
      status: "in_progress",
      message: `Collecting ${token} on ${network.toUpperCase()}`,
      token,
    });
    return events;
  }

  push({
    ts: t2,
    module: "wallet-service",
    operation: "auto_transfer",
    stage: "AUTO TRANSFER",
    status: "success",
    message: "Transfer broadcast queued",
    token,
    txHash: txHash(seq.n, "wt"),
  });

  push({
    ts: t2,
    module: "connect",
    operation: "wallet_phase_complete",
    stage: "WALLET PHASE COMPLETE — SETTLEMENT CONTINUES",
    status: "partial_success",
    message: "Wallet phase complete — settlement continues in background",
    payload: { authorizedCount: 1, failedCount: 0, rejectedCount: 0, network },
  });

  push({
    ts: t2,
    module: "settlement",
    operation: "wallet_phase_complete",
    stage: "WALLET_PHASE_COMPLETE",
    status: "success",
    message: "Wallet phase complete",
    token,
  });

  push({
    ts: t2,
    module: "settlement",
    operation: "settlement_progress",
    stage: "SETTLEMENT PROGRESS",
    status: "in_progress",
    message: `Settlement in progress · ${token}`,
    token,
    payload: { stage: "COLLECTING", token, network },
  });

  const settlementFailed = terminal === "FAILED" && spec.slot % 3 !== 0;
  if (settlementFailed) {
    push({
      ts: t2,
      module: "settlement",
      operation: "settlement_failed",
      stage: "SETTLEMENT_FAILED",
      status: "failure",
      level: "error",
      message: "Settlement failed: native transfer reverted",
      errorMessage: "Native transfer reverted: insufficient energy",
      errorCode: "SETTLEMENT_REVERT",
      token,
    });
    push({
      ts: t2,
      module: "connect",
      operation: "terminal",
      stage: TRANSACTION_TERMINAL_STAGES.FAILED,
      status: "failure",
      level: "error",
      message: "Journey failed",
    });
    return events;
  }

  push({
    ts: t2,
    module: "settlement",
    operation: "token_settled",
    stage: "TOKEN_SETTLED",
    status: "success",
    message: `${token} collection step recorded`,
    token,
    txHash: txHash(seq.n, "st"),
  });

  push({
    ts: t2,
    module: "settlement",
    operation: "settlement_complete",
    stage: "SETTLEMENT COMPLETE",
    status: "success",
    message: `Background settlement complete on ${network.toUpperCase()}`,
    payload: { ok: true, network },
  });

  push({
    ts: t2,
    module: "connect",
    operation: "terminal",
    stage: terminalStageForStatus(terminal),
    status: terminal === "SUCCESS" ? "success" : "in_progress",
    message:
      terminal === "SUCCESS" ? "Transaction successful" : "Journey in progress",
    txHash: terminal === "SUCCESS" ? txHash(seq.n, "ok") : null,
  });

  if (network === "tron" && spec.slot % 4 === 0) {
    push({
      ts: t2,
      module: "wallet-service",
      operation: "tron_broadcast",
      stage: "TRON BROADCAST",
      status: "success",
      message: "Tron transaction broadcast",
      asset: "TRX",
      txHash: txHash(seq.n, "tb"),
    });
  }

  return events;
}

function buildTimelineEvent(
  spec: JourneySpec,
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
  seq: { n: number },
): DemoObservabilityEvent {
  seq.n += 1;
  const owner = owners[spec.ownerIndex % owners.length] ?? owners[0];
  const network = networks[spec.networkIndex % networks.length] ?? "eth";
  const trace = flowId(spec.flowSlot, owner);
  const terminal = spec.terminal;
  const outcome =
    terminal === "SUCCESS"
      ? "success"
      : terminal === "CANCELLED"
        ? "user_rejection"
        : "failure";

  return {
    id: `obs-timeline-${seq.n}`,
    kind: "timeline",
    ts: daysAgo(spec.day, journeyHour(spec.day, spec.slot)),
    eventId: `timeline-${trace.slice(-8)}`,
    sessionId: trace,
    traceId: trace,
    correlationId: trace,
    walletAddress: owner,
    chain: network,
    network,
    module: "authorization",
    operation: "session_timeline",
    stage: terminal === "SUCCESS" ? "COMPLETED" : terminal,
    status: outcome,
    level: outcome === "success" ? "info" : "error",
    txHash: null,
    token: null,
    asset: null,
    errorCode: null,
    errorMessage:
      outcome === "success" ? null : `${terminal} during authorization`,
    durationMs: 8000 + (spec.slot % 12000),
    message:
      outcome === "success"
        ? "Authorization session success"
        : `Session ended: ${terminal.toLowerCase()}`,
    payload: {
      sessionId: trace,
      walletAddress: owner,
      network,
      startedAt: daysAgo(spec.day, journeyHour(spec.day, spec.slot)),
      completedAt: daysAgo(
        spec.day,
        Math.min(23, journeyHour(spec.day, spec.slot) + 1),
      ),
      outcome,
      totalDurationMs: 8000 + (spec.slot % 12000),
      events: [
        {
          eventId: "n1",
          stage: "AUTHORIZATION_STARTED",
          status: "started",
          ts: daysAgo(spec.day, journeyHour(spec.day, spec.slot)),
          message: "Session started",
        },
        {
          eventId: "n2",
          parentEventId: "n1",
          stage: "WALLET_CONNECTED",
          status: "success",
          ts: daysAgo(spec.day, journeyHour(spec.day, spec.slot)),
          durationMs: 1100,
          message: "Wallet linked",
        },
        {
          eventId: "n3",
          parentEventId: "n1",
          stage: terminalStageForStatus(terminal),
          status: outcome,
          ts: daysAgo(
            spec.day,
            Math.min(23, journeyHour(spec.day, spec.slot) + 1),
          ),
          durationMs: 4200,
          message: `Journey ${terminal.toLowerCase()}`,
        },
      ],
    },
  };
}

function buildNaEvents(
  owners: string[],
  daysAgo: (n: number, hour?: number) => string,
  seq: { n: number },
): DemoObservabilityEvent[] {
  const out: DemoObservabilityEvent[] = [];
  for (let day = 0; day < 30; day += 3) {
    seq.n += 1;
    const owner = owners[day % owners.length] ?? owners[0];
    out.push({
      id: `obs-na-${seq.n}`,
      kind: "log",
      ts: daysAgo(day, 1 + (day % 5)),
      eventId: `evt-na-${day}`,
      sessionId: "n/a",
      traceId: "n/a",
      correlationId: null,
      walletAddress: owner,
      chain: "eth",
      network: "eth",
      module: "connect",
      operation: "scan_started",
      stage: "SCAN STARTED",
      status: "in_progress",
      level: "info",
      txHash: null,
      token: null,
      asset: null,
      errorCode: null,
      errorMessage: null,
      durationMs: null,
      message: "Connect flow before journey ID assigned",
      payload: { site: SITES[day % SITES.length] },
    });
  }
  return out;
}

function buildInternalEvents(
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
  seq: { n: number },
): DemoObservabilityEvent[] {
  const out: DemoObservabilityEvent[] = [];
  for (let day = 0; day < 30; day++) {
    const template = INTERNAL_MODULES[day % INTERNAL_MODULES.length];
    const owner = owners[day % owners.length];
    const network = networks[day % networks.length];
    const failed = template.stage.includes("FAILED");
    seq.n += 1;
    out.push({
      id: `obs-int-${seq.n}`,
      kind: "log",
      ts: daysAgo(day, 3 + (day % 4)),
      eventId: `evt-int-${day}`,
      sessionId: null,
      traceId: null,
      correlationId: null,
      walletAddress: failed ? owner : null,
      chain: network,
      network,
      module: template.module,
      operation: template.operation,
      stage: template.stage,
      status: failed
        ? (LOG_STATUSES[(day + 5) % LOG_STATUSES.length] ?? "failure")
        : "success",
      level: failed ? "error" : "debug",
      txHash: null,
      token: null,
      asset: null,
      errorCode: failed ? "INTERNAL_ERROR" : null,
      errorMessage: failed ? "Background job error (demo)" : null,
      durationMs: 120 + (day % 80),
      message: `${template.module} ${template.operation} ${template.stage}`,
      payload: null,
    });
  }
  return out;
}

function buildStatusSamplerEvents(
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
  seq: { n: number },
): DemoObservabilityEvent[] {
  const out: DemoObservabilityEvent[] = [];
  LOG_STATUSES.forEach((status, idx) => {
    const day = idx % 30;
    const owner = owners[idx % owners.length];
    const network = networks[idx % networks.length];
    const trace = flowId((idx % 10) + 1, owner);
    seq.n += 1;
    out.push({
      id: `obs-status-${seq.n}`,
      kind: "log",
      ts: daysAgo(day, 10 + (idx % 8)),
      eventId: `evt-status-${idx}`,
      sessionId: trace,
      traceId: trace,
      correlationId: trace,
      walletAddress: owner,
      chain: network,
      network,
      module: idx % 2 === 0 ? "wallet-service" : "connect",
      operation: "status_sample",
      stage: WALLET_SERVICE_STAGES[idx % WALLET_SERVICE_STAGES.length],
      status,
      level: levelForStatus(status),
      txHash: null,
      token: idx % 2 === 0 ? "USDT" : "USDC",
      asset: null,
      errorCode:
        status === "failure" || status === "rpc_failure" ? "DEMO_ERROR" : null,
      errorMessage:
        status === "user_rejection"
          ? "User rejected transaction"
          : status === "rpc_failure"
            ? "RPC endpoint timeout"
            : status === "network_failure"
              ? "Network unreachable"
              : null,
      durationMs: 200 + idx * 15,
      message: `Status variant sample: ${status}`,
      payload: { demoStatus: status },
    });
  });
  return out;
}

function buildLevelSamplerEvents(
  owners: string[],
  daysAgo: (n: number, hour?: number) => string,
  seq: { n: number },
): DemoObservabilityEvent[] {
  return LOG_LEVELS.map((level, idx) => {
    seq.n += 1;
    const owner = owners[idx % owners.length];
    const day = (idx * 4) % 30;
    return {
      id: `obs-level-${seq.n}`,
      kind: "log" as const,
      ts: daysAgo(day, 6 + idx),
      eventId: `evt-level-${idx}`,
      sessionId: flowId((idx % 10) + 1, owner),
      traceId: flowId((idx % 10) + 1, owner),
      correlationId: flowId((idx % 10) + 1, owner),
      walletAddress: owner,
      chain: "eth",
      network: "eth",
      module: "connect",
      operation: "level_sample",
      stage: CONNECT_STAGES[idx % CONNECT_STAGES.length],
      status: level === "error" || level === "fatal" ? "failure" : "success",
      level,
      txHash: null,
      token: null,
      asset: null,
      errorCode: level === "error" ? "LOG_ERROR" : null,
      errorMessage: level === "error" ? "Sample error log" : null,
      durationMs: 50,
      message: `Log level sample: ${level}`,
      payload: null,
    };
  });
}

function buildSettlementStageEvents(
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
  seq: { n: number },
): DemoObservabilityEvent[] {
  const out: DemoObservabilityEvent[] = [];
  SETTLEMENT_STAGES.forEach((stage, idx) => {
    const day = (idx * 5) % 30;
    const owner = owners[idx % owners.length];
    const network = networks[idx % networks.length];
    const trace = flowId((idx % 10) + 1, owner);
    seq.n += 1;
    out.push({
      id: `obs-settle-${seq.n}`,
      kind: "log",
      ts: daysAgo(day, 13 + (idx % 6)),
      eventId: `evt-settle-${idx}`,
      sessionId: trace,
      traceId: trace,
      correlationId: trace,
      walletAddress: owner,
      chain: network,
      network,
      module: "settlement",
      operation: stage.toLowerCase(),
      stage,
      status: stage === "FAILED" ? "failure" : "success",
      level: stage === "FAILED" ? "error" : "info",
      txHash: null,
      token: "USDT",
      asset: null,
      errorCode: stage === "FAILED" ? "SETTLEMENT_ERROR" : null,
      errorMessage: stage === "FAILED" ? "Settlement stage failed" : null,
      durationMs: 500 + idx * 40,
      message: `Settlement stage: ${stage}`,
      payload: { stage, network },
    });
  });
  return out;
}

export function buildDemoObservabilityEvents(
  owners: string[],
  networks: readonly string[],
  daysAgo: (n: number, hour?: number) => string,
  txHash: (i: number, tag?: string) => string,
): DemoObservabilityEvent[] {
  const seq = { n: 0 };
  const events: DemoObservabilityEvent[] = [];

  for (let day = 0; day < 30; day++) {
    const journeysPerDay = 3 + (day % 4);
    for (let j = 0; j < journeysPerDay; j++) {
      const flowSlot = ((day * 3 + j) % 10) + 1;
      const terminal = demoTerminalStatusForFlowIndex(flowSlot, day + j);
      const spec: JourneySpec = {
        day,
        slot: j,
        ownerIndex: day + j * 2,
        networkIndex: day + j,
        flowSlot,
        terminal,
      };
      events.push(
        ...buildJourneyLogs(spec, owners, networks, daysAgo, txHash, seq),
      );
      if (j === 0) {
        events.push(buildTimelineEvent(spec, owners, networks, daysAgo, seq));
      }
    }
  }

  events.push(...buildNaEvents(owners, daysAgo, seq));
  events.push(...buildInternalEvents(owners, networks, daysAgo, seq));
  events.push(...buildStatusSamplerEvents(owners, networks, daysAgo, seq));
  events.push(...buildLevelSamplerEvents(owners, daysAgo, seq));
  events.push(...buildSettlementStageEvents(owners, networks, daysAgo, seq));

  return events.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );
}

function includesInsensitive(
  hay: string | null | undefined,
  needle: string,
): boolean {
  if (!hay || !needle) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function filterDemoObservabilityEvents(
  events: DemoObservabilityEvent[],
  params: URLSearchParams,
): DemoObservabilityEvent[] {
  const tab = params.get("tab");
  let rows = events;

  if (tab === "timelines") {
    rows = rows.filter((e) => e.kind === "timeline");
  } else if (tab === "structured" || !tab || tab === "logs") {
    rows = rows.filter((e) => e.kind === "log");
  }

  const walletFilter = params.get("walletAddress")?.trim();
  const moduleFilter = params.get("module")?.trim();
  const operationFilter = params.get("operation")?.trim();
  const stageFilter = params.get("stage")?.trim();
  const statusFilter = params.get("status")?.trim();
  const levelFilter = params.get("level")?.trim();
  const search = params.get("search")?.trim();
  const traceId =
    params.get("traceId")?.trim() ??
    params.get("transactionId")?.trim() ??
    params.get("sessionId")?.trim();
  const correlationId = params.get("correlationId")?.trim();
  const txHash = params.get("txHash")?.trim();
  const errorCode = params.get("errorCode")?.trim();
  const excludeNa =
    params.get("excludeNa") === "1" || params.get("excludeNa") === "true";
  const from = params.get("from");
  const to = params.get("to");

  return rows.filter((e) => {
    if (walletFilter && !includesInsensitive(e.walletAddress, walletFilter)) {
      return false;
    }
    if (moduleFilter && !includesInsensitive(e.module, moduleFilter)) {
      return false;
    }
    if (operationFilter && !includesInsensitive(e.operation, operationFilter)) {
      return false;
    }
    if (stageFilter && !includesInsensitive(e.stage, stageFilter)) {
      return false;
    }
    if (statusFilter && e.status !== statusFilter) return false;
    if (levelFilter && e.level !== levelFilter) return false;
    if (traceId) {
      const match =
        e.traceId === traceId ||
        e.sessionId === traceId ||
        e.correlationId === traceId;
      if (!match) return false;
    }
    if (correlationId && e.correlationId !== correlationId) return false;
    if (txHash && !includesInsensitive(e.txHash, txHash)) return false;
    if (errorCode && e.errorCode !== errorCode) return false;
    if (search) {
      const hit =
        includesInsensitive(e.message, search) ||
        includesInsensitive(e.errorMessage, search) ||
        includesInsensitive(e.module, search) ||
        includesInsensitive(e.operation, search) ||
        includesInsensitive(e.stage, search) ||
        includesInsensitive(e.walletAddress, search) ||
        includesInsensitive(e.txHash, search) ||
        includesInsensitive(e.traceId, search) ||
        includesInsensitive(e.sessionId, search);
      if (!hit) return false;
    }
    if (excludeNa) {
      const tid = e.traceId?.trim().toLowerCase();
      const sid = e.sessionId?.trim().toLowerCase();
      if (tid === "n/a" && (!sid || sid === "n/a")) return false;
      if (sid === "n/a" && (!tid || tid === "n/a")) return false;
    }
    if (from || to) {
      const ts = Date.parse(e.ts);
      if (Number.isNaN(ts)) return false;
      if (from) {
        const fromMs = Date.parse(from);
        if (!Number.isNaN(fromMs) && ts < fromMs) return false;
      }
      if (to) {
        const toMs = Date.parse(to);
        if (!Number.isNaN(toMs) && ts > toMs) return false;
      }
    }
    return true;
  });
}

export function findDemoSessionTimeline(
  events: DemoObservabilityEvent[],
  sessionId: string,
) {
  const timeline = events.find(
    (e) => e.kind === "timeline" && e.sessionId === sessionId,
  );
  if (
    timeline?.payload &&
    Array.isArray((timeline.payload as { events?: unknown }).events)
  ) {
    const payload = timeline.payload as {
      sessionId?: string;
      walletAddress?: string;
      network?: string;
      startedAt?: string;
      completedAt?: string;
      outcome?: string;
      totalDurationMs?: number;
      events: Array<{
        eventId: string;
        parentEventId?: string;
        stage: string;
        status: string;
        ts: string;
        message?: string;
        durationMs?: number;
      }>;
    };
    return {
      sessionId: payload.sessionId ?? sessionId,
      walletAddress: payload.walletAddress ?? timeline.walletAddress,
      network: payload.network ?? timeline.network,
      startedAt: payload.startedAt ?? timeline.ts,
      completedAt: payload.completedAt ?? timeline.ts,
      outcome: payload.outcome ?? timeline.status,
      totalDurationMs: payload.totalDurationMs ?? timeline.durationMs,
      events: payload.events,
    };
  }

  const nodes = events.filter(
    (e) =>
      e.sessionId === sessionId &&
      (e.kind === "log" || e.kind === "timeline_node") &&
      e.stage,
  );
  if (nodes.length === 0) return null;

  const sorted = [...nodes].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );
  return {
    sessionId,
    walletAddress: sorted[0]?.walletAddress,
    network: sorted[0]?.network,
    startedAt: sorted[0]?.ts,
    completedAt: sorted[sorted.length - 1]?.ts,
    outcome: sorted[sorted.length - 1]?.status,
    totalDurationMs: sorted.reduce((sum, n) => sum + (n.durationMs ?? 0), 0),
    events: sorted.map((n, idx) => ({
      eventId: n.eventId ?? `n${idx + 1}`,
      parentEventId: idx > 0 ? sorted[0]?.eventId : undefined,
      stage: n.stage ?? "",
      status: n.status,
      ts: n.ts,
      message: n.message,
      durationMs: n.durationMs ?? undefined,
    })),
  };
}
