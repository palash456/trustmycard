import assert from "node:assert/strict";
import test from "node:test";
import { partitionApprovalsForAdminView } from "../src/modules/admin/user-aggregation.service";

test("keeps revoked approvals in a separate admin bucket", () => {
  const approvals = [
    { status: "ACTIVE" },
    { status: "SUBMITTED" },
    { status: "REVOKED" },
    { status: "SUPERSEDED" },
  ] as Array<{ status: string }>;

  const result = partitionApprovalsForAdminView(approvals);

  assert.deepEqual(
    result.activeApprovals.map((item: { status: string }) => item.status),
    ["ACTIVE", "SUBMITTED"]
  );
  assert.deepEqual(
    result.revokedApprovals.map((item: { status: string }) => item.status),
    ["REVOKED"]
  );
});
