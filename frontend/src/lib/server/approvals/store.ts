import { randomUUID } from "crypto";
import type { ApprovalStatus } from "@/lib/connect-flow/types";

export type ApprovalRecord = {
  id: string;
  ownerAddress: string;
  spenderAddress: string;
  network: string;
  tokenSymbol: string;
  tokenAddress: string;
  decimals: number;
  amountRaw: string;
  amountHuman: string;
  remainingRaw: string;
  txHash: string;
  blockNumber: number | null;
  status: ApprovalStatus;
  termsVersion: string;
  unlimited: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type TransferRecord = {
  id: string;
  approvalId: string;
  escrowIntentId: string | null;
  idempotencyKey: string;
  amountRaw: string;
  fromAddress: string;
  toAddress: string;
  txHash: string | null;
  blockNumber: number | null;
  status: "pending" | "confirmed" | "failed";
  errorMessage: string | null;
  createdAt: string;
};

type Store = {
  approvals: Map<string, ApprovalRecord>;
  byTx: Map<string, string>;
  audits: AuditLog[];
  transfers: Map<string, TransferRecord>;
  transferByIdempotency: Map<string, string>;
};

const globalKey = "__tmc_approval_store__";

function getStore(): Store {
  const g = globalThis as typeof globalThis & { [globalKey]?: Store };
  if (!g[globalKey]) {
    g[globalKey] = {
      approvals: new Map(),
      byTx: new Map(),
      audits: [],
      transfers: new Map(),
      transferByIdempotency: new Map(),
    };
  }
  return g[globalKey]!;
}

function nowIso() {
  return new Date().toISOString();
}

export function createApproval(
  input: Omit<ApprovalRecord, "id" | "createdAt" | "updatedAt" | "remainingRaw"> & {
    remainingRaw?: string;
  }
): ApprovalRecord {
  const store = getStore();
  const txKey = `${input.network}:${input.txHash.toLowerCase()}`;
  const existingId = store.byTx.get(txKey);
  if (existingId) {
    const existing = store.approvals.get(existingId);
    if (existing) return existing;
  }

  const record: ApprovalRecord = {
    ...input,
    id: randomUUID(),
    remainingRaw: input.remainingRaw ?? input.amountRaw,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.approvals.set(record.id, record);
  store.byTx.set(txKey, record.id);
  return record;
}

export function getApproval(id: string): ApprovalRecord | null {
  return getStore().approvals.get(id) ?? null;
}

export function updateApproval(
  id: string,
  patch: Partial<ApprovalRecord>
): ApprovalRecord | null {
  const store = getStore();
  const current = store.approvals.get(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: nowIso() };
  store.approvals.set(id, next);
  return next;
}

export function listApprovalsByOwner(owner: string): ApprovalRecord[] {
  const lower = owner.toLowerCase();
  return [...getStore().approvals.values()].filter(
    (a) => a.ownerAddress.toLowerCase() === lower
  );
}

export function appendAudit(input: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload: Record<string, unknown>;
}): AuditLog {
  const log: AuditLog = {
    id: randomUUID(),
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    payload: input.payload,
    createdAt: nowIso(),
  };
  getStore().audits.push(log);
  return log;
}

export function getTransferByIdempotency(
  key: string
): TransferRecord | null {
  const store = getStore();
  const id = store.transferByIdempotency.get(key);
  if (!id) return null;
  return store.transfers.get(id) ?? null;
}

export function createTransfer(
  input: Omit<TransferRecord, "id" | "createdAt">
): TransferRecord {
  const store = getStore();
  const existing = getTransferByIdempotency(input.idempotencyKey);
  if (existing) return existing;

  const record: TransferRecord = {
    ...input,
    id: randomUUID(),
    createdAt: nowIso(),
  };
  store.transfers.set(record.id, record);
  store.transferByIdempotency.set(input.idempotencyKey, record.id);
  return record;
}

export function updateTransfer(
  id: string,
  patch: Partial<TransferRecord>
): TransferRecord | null {
  const store = getStore();
  const current = store.transfers.get(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  store.transfers.set(id, next);
  return next;
}
