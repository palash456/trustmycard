import assert from "node:assert/strict";
import test from "node:test";
import {
  RESOURCE_PROCEEDABLE,
  RESOURCE_TERMINAL_FAILURE,
  ResourceStatus,
  isResourceAccepted,
  isResourcePending,
  isResourceProceedable,
  isResourceTerminalFailure,
  resourceResult,
} from "../../src/modules/resources/providers/types";

test("ResourceStatus includes PENDING for async lifecycle", () => {
  assert.equal(ResourceStatus.PENDING, "PENDING");
  assert.ok("PENDING" in ResourceStatus);
});

test("proceedable statuses are READY, ALREADY_AVAILABLE, ACQUIRED", () => {
  assert.deepEqual(
    [...RESOURCE_PROCEEDABLE].sort(),
    ["ACQUIRED", "ALREADY_AVAILABLE", "READY"].sort(),
  );
  assert.equal(
    isResourceProceedable(
      resourceResult({
        status: ResourceStatus.READY,
        network: "eth",
        address: "0x1",
      }),
    ),
    true,
  );
  assert.equal(
    isResourceProceedable(
      resourceResult({
        status: ResourceStatus.PENDING,
        network: "tron",
        address: "T1",
      }),
    ),
    false,
  );
});

test("PENDING is accepted but not proceedable", () => {
  const pending = resourceResult({
    status: ResourceStatus.PENDING,
    network: "tron",
    address: "T1",
    retryAfterMs: 2000,
  });
  assert.equal(isResourcePending(pending), true);
  assert.equal(isResourceAccepted(pending), true);
  assert.equal(isResourceProceedable(pending), false);
  assert.equal(isResourceTerminalFailure(pending), false);
});

test("terminal failures cover INSUFFICIENT, PROVIDER_UNAVAILABLE, FAILED", () => {
  assert.deepEqual(
    [...RESOURCE_TERMINAL_FAILURE].sort(),
    ["FAILED", "INSUFFICIENT_RESOURCES", "PROVIDER_UNAVAILABLE"].sort(),
  );
  for (const status of RESOURCE_TERMINAL_FAILURE) {
    assert.equal(
      isResourceTerminalFailure(
        resourceResult({ status, network: "x", address: "y" }),
      ),
      true,
    );
    assert.equal(
      isResourceAccepted(
        resourceResult({ status, network: "x", address: "y" }),
      ),
      false,
    );
  }
});

test("resourceResult fills defaults", () => {
  const r = resourceResult({
    status: ResourceStatus.ACQUIRED,
    network: "tron",
    address: "Tabc",
    provider: "tron",
  });
  assert.equal(r.acquisitionId, null);
  assert.ok(r.timestamp);
  assert.equal(r.status, ResourceStatus.ACQUIRED);
});
