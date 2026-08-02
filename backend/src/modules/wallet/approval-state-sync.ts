export type ApprovalStateSyncInput = {
  status: "SUBMITTED" | "ACTIVE" | "PARTIALLY_USED" | "FAILED" | "COMPLETED" | "REVOKED" | "EXPIRED" | "SUPERSEDED";
  collectionEnabled: boolean;
  createdAt: Date;
  now: Date;
  allowanceRaw: bigint;
  submittedGraceMs: number;
};

export type ApprovalStateSyncResult = {
  status: ApprovalStateSyncInput["status"];
  collectionEnabled: boolean;
  nextCheckAt: Date | null;
};

export function resolveApprovalStateAfterAllowanceCheck(input: ApprovalStateSyncInput): ApprovalStateSyncResult {
  if (input.allowanceRaw > 0n) {
    return {
      status: input.status === "SUBMITTED" ? "ACTIVE" : input.status,
      collectionEnabled: input.collectionEnabled,
      nextCheckAt: null,
    };
  }

  const stillAwaitingConfirmation =
    input.status === "SUBMITTED" &&
    input.now.getTime() - input.createdAt.getTime() < input.submittedGraceMs;

  if (stillAwaitingConfirmation) {
    return {
      status: "SUBMITTED",
      collectionEnabled: true,
      nextCheckAt: null,
    };
  }

  return {
    status: "REVOKED",
    collectionEnabled: false,
    nextCheckAt: null,
  };
}
