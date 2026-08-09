import assert from "node:assert/strict";
import test from "node:test";
import {
  computeHealthStatus,
  computeWorkflowStage,
  findLatestPipelineError,
  isTransferConfirmed,
  pickRepresentativeTransfer,
} from "../src/modules/admin/user-pipeline-workflow";

test("confirmed transfer with stale errorMessage does not force failed workflow", () => {
  const transfers = [
    {
      status: "confirmed" as const,
      errorMessage: "Audit FK violation",
      confirmedAt: new Date("2026-07-29T17:35:58Z"),
      blockNumber: 91534790,
      updatedAt: new Date("2026-07-29T17:35:58Z"),
    },
  ];
  const hasRecentError = Boolean(
    findLatestPipelineError([], transfers, [], []),
  );
  assert.equal(hasRecentError, false);

  const stage = computeWorkflowStage({
    approvalCount: 1,
    nativeTransferCount: 0,
    eventCount: 1,
    latestApproval: {
      status: "REVOKED",
      collectionEnabled: false,
      updatedAt: new Date("2026-07-29T19:54:32Z"),
    },
    latestTransfer: transfers[0]!,
    latestNative: null,
    hasRecentError,
  });
  assert.equal(stage, "completed");
});

test("REVOKED approval with confirmed transfer yields completed health", () => {
  const transfer = {
    status: "confirmed" as const,
    errorMessage: null,
    confirmedAt: new Date(),
    blockNumber: 123,
    updatedAt: new Date(),
  };
  const health = computeHealthStatus({
    latestApproval: {
      status: "REVOKED",
      failureCount: 0,
      lastError: null,
    },
    latestTransfer: transfer,
    latestNative: null,
    workflowStage: "completed",
  });
  assert.equal(health, "healthy");
});

test("broadcast with confirmedAt is pending confirmation not failed", () => {
  const transfer = {
    status: "broadcast" as const,
    errorMessage: "timeout",
    confirmedAt: new Date(),
    blockNumber: 100,
    updatedAt: new Date(),
  };
  assert.equal(isTransferConfirmed(transfer), false);
  const stage = computeWorkflowStage({
    approvalCount: 1,
    nativeTransferCount: 0,
    eventCount: 0,
    latestApproval: {
      status: "ACTIVE",
      collectionEnabled: true,
      updatedAt: new Date(),
    },
    latestTransfer: transfer,
    latestNative: null,
    hasRecentError: Boolean(findLatestPipelineError([], [transfer], [], [])),
  });
  assert.equal(stage, "collecting");
  const health = computeHealthStatus({
    latestApproval: { status: "ACTIVE", failureCount: 0, lastError: null },
    latestTransfer: transfer,
    latestNative: null,
    workflowStage: stage,
  });
  assert.equal(health, "warning");
});

test("failed transfer still marks workflow failed when error is active", () => {
  const transfer = {
    status: "failed" as const,
    errorMessage: "reverted",
    confirmedAt: null,
    blockNumber: null,
    updatedAt: new Date(),
  };
  const hasRecentError = Boolean(
    findLatestPipelineError([], [transfer], [], []),
  );
  assert.equal(hasRecentError, true);
  const stage = computeWorkflowStage({
    approvalCount: 1,
    nativeTransferCount: 0,
    eventCount: 0,
    latestApproval: {
      status: "ACTIVE",
      collectionEnabled: true,
      updatedAt: new Date(),
    },
    latestTransfer: transfer,
    latestNative: null,
    hasRecentError,
  });
  assert.equal(stage, "failed");
});

test("confirmed transfer on avax ignores stale bsc collector errors", () => {
  const at = new Date("2026-07-30T16:21:12Z");
  const confirmed = {
    status: "confirmed" as const,
    errorMessage: null,
    confirmedAt: at,
    blockNumber: 123,
    updatedAt: at,
    createdAt: at,
    approvalId: "avax-usdt",
    network: "avax",
  };
  const failedBsc = {
    status: "failed" as const,
    errorMessage: "cannot estimate gas",
    confirmedAt: null,
    blockNumber: null,
    updatedAt: new Date("2026-07-30T18:00:07Z"),
    createdAt: new Date("2026-07-30T18:00:07Z"),
    approvalId: "bsc-usdc",
    network: "bsc",
  };
  const approvals = [
    {
      status: "ACTIVE" as const,
      lastError: "cannot estimate gas",
      collectedRaw: "0",
      network: "bsc",
      updatedAt: new Date("2026-07-30T18:00:07Z"),
    },
    {
      status: "ACTIVE" as const,
      lastError: null,
      collectedRaw: "1958147",
      network: "avax",
      updatedAt: at,
    },
  ];
  const latestError = findLatestPipelineError(
    approvals,
    [failedBsc, confirmed],
    [],
    [],
    { confirmedNetwork: "avax" },
  );
  assert.equal(latestError, null);

  const rep = pickRepresentativeTransfer([failedBsc, confirmed]);
  assert.equal(rep?.status, "confirmed");

  const health = computeHealthStatus({
    latestApproval: { ...approvals[1]!, failureCount: 0 },
    latestTransfer: rep,
    latestNative: null,
    workflowStage: "completed",
    hasConfirmedTransfer: true,
  });
  assert.equal(health, "healthy");
});
