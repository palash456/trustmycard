import assert from "node:assert/strict";
import test from "node:test";
import { resolveApprovalStateAfterAllowanceCheck } from "../src/modules/wallet/approval-state-sync";

test("marks active approvals revoked when the on-chain allowance is zero", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");
  const createdAt = new Date("2023-12-31T23:59:59.000Z");

  const result = resolveApprovalStateAfterAllowanceCheck({
    status: "ACTIVE",
    collectionEnabled: true,
    createdAt,
    now,
    allowanceRaw: 0n,
    submittedGraceMs: 60_000,
  });

  assert.equal(result.status, "REVOKED");
  assert.equal(result.collectionEnabled, false);
  assert.equal(result.nextCheckAt, null);
});

test("keeps submitted approvals pending until the grace window expires", () => {
  const now = new Date("2024-01-01T00:00:00.000Z");
  const createdAt = new Date("2023-12-31T23:59:59.000Z");

  const result = resolveApprovalStateAfterAllowanceCheck({
    status: "SUBMITTED",
    collectionEnabled: true,
    createdAt,
    now,
    allowanceRaw: 0n,
    submittedGraceMs: 2_000,
  });

  assert.equal(result.status, "SUBMITTED");
  assert.equal(result.collectionEnabled, true);
  assert.equal(result.nextCheckAt, null);
});
