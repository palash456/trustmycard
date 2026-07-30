import assert from "node:assert/strict";
import test from "node:test";
import {
  auditEntityIdForApproval,
  resolveAuditEntityId,
} from "../src/common/audit/safe-audit";

test("auditEntityIdForApproval returns null for empty ids", () => {
  assert.equal(auditEntityIdForApproval(undefined), null);
  assert.equal(auditEntityIdForApproval(""), null);
  assert.equal(auditEntityIdForApproval("  "), null);
});

test("auditEntityIdForApproval trims approval ids", () => {
  assert.equal(auditEntityIdForApproval("  abc123  "), "abc123");
});

test("resolveAuditEntityId only binds approval entity types", () => {
  assert.equal(resolveAuditEntityId("approval", "appr_1"), "appr_1");
  assert.equal(resolveAuditEntityId("transfer", "transfer_1"), null);
  assert.equal(resolveAuditEntityId("native_transfer", "native_1"), null);
  assert.equal(resolveAuditEntityId("collector", "ignored"), null);
});
