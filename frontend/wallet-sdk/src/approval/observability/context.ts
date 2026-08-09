import type { ApprovalContext } from "../types";

export type ApprovalLogContext = {
  traceId: string;
  network: string;
  owner: string;
  token: string;
  lifecycleState?: string;
  unlimited?: boolean;
  txHash?: string | null;
  preparedTxId?: string | null;
  resourceStatus?: string | null;
  resourceAcquisitionId?: string | null;
  confirmation?: {
    confirmed?: boolean;
    blockNumber?: number | null;
    confirmations?: number;
    waitedMs?: number;
    attempts?: number;
  } | null;
  verification?: {
    hasAllowance?: boolean;
    allowance?: string;
  } | null;
  approvalId?: string | null;
  stage?: string;
  attempt?: number;
  elapsedMs?: number | null;
};

export function buildApprovalLogContext(
  ctx: ApprovalContext,
  extras: Partial<ApprovalLogContext> = {},
): ApprovalLogContext {
  return {
    traceId: ctx.request.traceId ?? "n/a",
    network: ctx.request.network,
    owner: ctx.request.owner,
    token: ctx.request.token,
    lifecycleState: ctx.lifecycleState,
    unlimited: ctx.request.unlimited ?? false,
    txHash: ctx.broadcast?.txHash ?? null,
    preparedTxId: ctx.prepared?.preparedTxId ?? null,
    resourceStatus: ctx.resources?.acquireStatus ?? null,
    resourceAcquisitionId: ctx.resources?.acquisitionId ?? null,
    confirmation: ctx.confirmation
      ? {
          confirmed: ctx.confirmation.confirmed,
          blockNumber: ctx.confirmation.blockNumber ?? null,
          confirmations: ctx.confirmation.confirmations,
          waitedMs: ctx.confirmation.waitedMs,
          attempts: ctx.confirmation.attempts,
        }
      : null,
    verification: ctx.verified
      ? {
          hasAllowance: ctx.verified.hasAllowance,
          allowance: ctx.verified.allowance,
        }
      : null,
    approvalId: ctx.persisted?.approvalId ?? null,
    ...extras,
  };
}

/** Strip null/undefined for compact log payloads. */
export function compactLogDetail(
  detail: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
