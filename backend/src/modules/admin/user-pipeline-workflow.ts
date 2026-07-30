import type { ApprovalStatus, TransferStatus } from "@prisma/client";

export type WorkflowStage =
  | "idle"
  | "connected"
  | "approving"
  | "approved"
  | "collecting"
  | "completed"
  | "native_pending"
  | "failed";

export type HealthStatus = "healthy" | "warning" | "error" | "idle";

type TransferLike = {
  status: TransferStatus;
  errorMessage?: string | null;
  confirmedAt?: Date | null;
  blockNumber?: number | null;
  updatedAt?: Date;
  createdAt?: Date;
};

type ApprovalLike = {
  status: ApprovalStatus;
  lastError?: string | null;
  updatedAt?: Date;
};

type NativeLike = {
  status: TransferStatus;
  errorMessage?: string | null;
  confirmedAt?: Date | null;
  updatedAt?: Date;
};

type EventLike = {
  error?: string | null;
  createdAt: Date;
};

export function isTransferConfirmed(transfer: TransferLike | null): boolean {
  if (!transfer) return false;
  return transfer.status === "confirmed";
}

export function isTransferPendingConfirmation(
  transfer: TransferLike | null
): boolean {
  if (!transfer) return false;
  if (transfer.status === "confirmed" || transfer.status === "failed") {
    return false;
  }
  return (
    transfer.status === "prepared" ||
    transfer.status === "pending" ||
    transfer.status === "broadcast"
  );
}

export function isNativePending(native: NativeLike | null): boolean {
  return native?.status === "pending";
}

export function isNativeConfirmed(native: NativeLike | null): boolean {
  return native?.status === "confirmed";
}

/** Ignore stale errorMessage on successfully settled rows. */
export function transferErrorMessage(transfer: TransferLike | null): string | null {
  if (!transfer?.errorMessage) return null;
  if (isTransferConfirmed(transfer)) return null;
  if (
    transfer.status === "broadcast" &&
    transfer.confirmedAt != null &&
    transfer.blockNumber != null
  ) {
    return null;
  }
  return transfer.errorMessage;
}

export function nativeErrorMessage(native: NativeLike | null): string | null {
  if (!native?.errorMessage) return null;
  if (isNativeConfirmed(native)) return null;
  return native.errorMessage;
}

export function approvalErrorMessage(approval: ApprovalLike | null): string | null {
  if (!approval?.lastError) return null;
  if (approval.status === "COMPLETED") return null;
  return approval.lastError;
}

export function findLatestPipelineError(
  approvals: ApprovalLike[],
  transfers: TransferLike[],
  nativeTransfers: NativeLike[],
  events: EventLike[]
): string | null {
  const candidates: Array<{ at: Date; message: string }> = [];
  for (const a of approvals) {
    const message = approvalErrorMessage(a);
    if (message && a.updatedAt) candidates.push({ at: a.updatedAt, message });
  }
  for (const t of transfers) {
    const message = transferErrorMessage(t);
    if (message && t.updatedAt) candidates.push({ at: t.updatedAt, message });
  }
  for (const n of nativeTransfers) {
    const message = nativeErrorMessage(n);
    if (message && n.updatedAt) candidates.push({ at: n.updatedAt, message });
  }
  for (const e of events) {
    if (e.error) candidates.push({ at: e.createdAt, message: e.error });
  }
  candidates.sort((a, b) => b.at.getTime() - a.at.getTime());
  return candidates[0]?.message ?? null;
}

export function computeWorkflowStage(args: {
  approvalCount: number;
  nativeTransferCount: number;
  eventCount: number;
  latestApproval: {
    status: ApprovalStatus;
    collectionEnabled: boolean;
    updatedAt: Date;
  } | null;
  latestTransfer: TransferLike | null;
  latestNative: NativeLike | null;
  hasRecentError: boolean;
}): WorkflowStage {
  const { latestApproval, latestTransfer, latestNative, hasRecentError } = args;

  if (
    isTransferConfirmed(latestTransfer) &&
    latestApproval &&
    (latestApproval.status === "REVOKED" ||
      latestApproval.status === "COMPLETED" ||
      latestApproval.status === "EXPIRED")
  ) {
    if (!latestNative || latestNative.status === "confirmed") {
      return "completed";
    }
  }

  if (isTransferConfirmed(latestTransfer) && !latestNative) {
    if (
      latestApproval?.status === "REVOKED" ||
      latestApproval?.status === "COMPLETED"
    ) {
      return "completed";
    }
  }

  if (hasRecentError) return "failed";

  if (isNativePending(latestNative)) return "native_pending";

  if (isTransferPendingConfirmation(latestTransfer)) {
    if (
      latestApproval?.collectionEnabled &&
      (latestApproval.status === "ACTIVE" ||
        latestApproval.status === "PARTIALLY_USED")
    ) {
      return "collecting";
    }
  }

  if (latestApproval) {
    if (latestApproval.status === "SUBMITTED") return "approving";
    if (latestApproval.status === "ACTIVE" && !latestTransfer) {
      return "approved";
    }
    if (
      latestApproval.collectionEnabled &&
      (latestApproval.status === "ACTIVE" ||
        latestApproval.status === "PARTIALLY_USED")
    ) {
      if (isTransferConfirmed(latestTransfer)) {
        return isNativePending(latestNative) ? "native_pending" : "completed";
      }
      return "collecting";
    }
    if (
      latestApproval.status === "COMPLETED" ||
      latestApproval.status === "REVOKED" ||
      latestApproval.status === "EXPIRED"
    ) {
      if (!latestNative || latestNative.status === "confirmed") {
        return "completed";
      }
    }
  }

  if (isTransferConfirmed(latestTransfer)) {
    return isNativePending(latestNative) ? "native_pending" : "completed";
  }

  if (args.approvalCount === 0 && args.nativeTransferCount === 0) {
    return args.eventCount > 0 ? "connected" : "idle";
  }

  if (latestApproval) {
    if (latestApproval.status === "ACTIVE") return "approved";
    if (latestApproval.status === "PARTIALLY_USED") return "collecting";
  }

  return "idle";
}

export function computeHealthStatus(args: {
  latestApproval: {
    status: ApprovalStatus;
    failureCount: number;
    lastError: string | null;
  } | null;
  latestTransfer: TransferLike | null;
  latestNative: NativeLike | null;
  workflowStage: WorkflowStage;
}): HealthStatus {
  const { latestApproval, latestTransfer, latestNative, workflowStage } = args;

  const transferErr = transferErrorMessage(latestTransfer);
  const nativeErr = nativeErrorMessage(latestNative);
  const approvalErr = approvalErrorMessage(latestApproval);

  if (
    latestApproval?.status === "FAILED" ||
    latestTransfer?.status === "failed" ||
    latestNative?.status === "failed" ||
    ((latestApproval?.failureCount ?? 0) > 0 && latestApproval?.status !== "COMPLETED") ||
    approvalErr ||
    transferErr ||
    nativeErr
  ) {
    return "error";
  }

  if (workflowStage === "failed") return "error";

  if (
    isNativePending(latestNative) ||
    isTransferPendingConfirmation(latestTransfer) ||
    latestApproval?.status === "SUBMITTED"
  ) {
    return "warning";
  }

  if (workflowStage === "idle" || workflowStage === "connected") return "idle";

  if (
    workflowStage === "collecting" ||
    workflowStage === "completed" ||
    workflowStage === "approved" ||
    isNativeConfirmed(latestNative) ||
    isTransferConfirmed(latestTransfer)
  ) {
    return "healthy";
  }

  return "warning";
}
