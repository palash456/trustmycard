import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyFailure,
  FailureKind,
  isStageRetryAllowed,
  stageHasArtifact,
} from "../../src/approval/resilience/errors";
import {
  computeBackoffDelay,
  DEFAULT_RETRY_POLICY,
  withRetry,
} from "../../src/approval/resilience/retry";
import { ApprovalStageName } from "../../src/approval/types";

describe("classifyFailure", () => {
  it("marks user rejection as permanent", () => {
    const c = classifyFailure(new Error("User rejected the request"));
    assert.equal(c.kind, FailureKind.USER_REJECTION);
    assert.equal(c.retryable, false);
  });

  it("marks RPC timeout as transient", () => {
    const c = classifyFailure(new Error("fetch failed: ETIMEDOUT"));
    assert.equal(c.kind, FailureKind.TRANSIENT);
    assert.equal(c.retryable, true);
  });

  it("marks invalid address as permanent", () => {
    const c = classifyFailure(new Error("Invalid Tron owner/spender"));
    assert.equal(c.kind, FailureKind.PERMANENT);
    assert.equal(c.retryable, false);
  });

  it("marks duplicate broadcast as non-retryable transient", () => {
    const c = classifyFailure(new Error("transaction already known"));
    assert.equal(c.code, "IDEMPOTENT_DUPLICATE");
    assert.equal(c.retryable, false);
  });
});

describe("stageHasArtifact / isStageRetryAllowed", () => {
  it("blocks broadcast retry when txHash exists", () => {
    const ctx = {
      request: { network: "tron", owner: "T", token: "USDT" },
      stageLog: [],
      broadcast: { txHash: "abc" },
    };
    assert.equal(stageHasArtifact(ApprovalStageName.BROADCAST, ctx), true);
    assert.equal(
      isStageRetryAllowed(
        ApprovalStageName.BROADCAST,
        { retryable: true, status: "FAILED" },
        ctx
      ),
      false
    );
  });
});

describe("computeBackoffDelay / withRetry", () => {
  it("applies exponential backoff with cap", () => {
    const d1 = computeBackoffDelay(1, DEFAULT_RETRY_POLICY, () => 0);
    const d3 = computeBackoffDelay(3, DEFAULT_RETRY_POLICY, () => 0);
    assert.ok(d3 >= d1);
    assert.ok(d3 <= DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("503 service unavailable");
        return "ok";
      },
      { ...DEFAULT_RETRY_POLICY, maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 }
    );
    assert.equal(result, "ok");
    assert.equal(calls, 3);
  });

  it("does not retry permanent failures", async () => {
    let calls = 0;
    await assert.rejects(() =>
      withRetry(
        async () => {
          calls += 1;
          throw new Error("Invalid address format");
        },
        { ...DEFAULT_RETRY_POLICY, maxAttempts: 3, baseDelayMs: 1 }
      )
    );
    assert.equal(calls, 1);
  });
});
