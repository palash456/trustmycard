import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildApprovalLogContext } from "../../src/approval/observability/context";
import { createStructuredApprovalLogger } from "../../src/approval/observability/structured-logger";
import { ApprovalLifecycleState } from "../../src/approval/lifecycle/types";

describe("structured approval logging", () => {
  it("buildApprovalLogContext includes lifecycle and tx fields", () => {
    const ctx = buildApprovalLogContext({
      request: {
        network: "tron",
        owner: "TOwner",
        token: "USDT",
        traceId: "t-1",
        unlimited: true,
      },
      lifecycleState: ApprovalLifecycleState.CONFIRMING,
      stageLog: [],
      broadcast: { txHash: "0xabc" },
      confirmation: {
        txHash: "0xabc",
        waitedMs: 100,
        confirmed: true,
        confirmations: 1,
      },
      verified: { hasAllowance: true, allowance: "999" },
      resources: { acquireStatus: "READY", acquisitionId: "acq-1" },
    });
    assert.equal(ctx.traceId, "t-1");
    assert.equal(ctx.txHash, "0xabc");
    assert.equal(ctx.lifecycleState, ApprovalLifecycleState.CONFIRMING);
    assert.equal(ctx.resourceStatus, "READY");
    assert.equal(ctx.confirmation?.confirmed, true);
    assert.equal(ctx.verification?.allowance, "999");
  });

  it("buildApprovalLogContext does not include sessionId field", () => {
    const ctx = buildApprovalLogContext({
      request: {
        network: "eth",
        owner: "0x1",
        token: "USDT",
        traceId: "flow-trace-only",
      },
      lifecycleState: ApprovalLifecycleState.SIGNING,
      stageLog: [],
    });
    assert.equal(ctx.traceId, "flow-trace-only");
    assert.equal("sessionId" in ctx, false);
  });

  it("createStructuredApprovalLogger merges context into events", () => {
    const events: Array<{ level: string; event: string; detail: Record<string, unknown> }> =
      [];
    const ctx = {
      request: {
        network: "eth",
        owner: "0x1",
        token: "USDT",
        traceId: "trace-99",
      },
      lifecycleState: ApprovalLifecycleState.SIGNING,
      stageLog: [],
    };
    const logger = createStructuredApprovalLogger({
      base: {
        info: (event, detail) => events.push({ level: "info", event, detail: detail ?? {} }),
        warn: () => {},
        error: () => {},
      },
      getContext: () => ctx,
    });
    logger.info("STAGE_START", { stage: "SIGN", attempt: 0 });
    assert.equal(events.length, 1);
    assert.equal(events[0]!.event, "STAGE_START");
    assert.equal(events[0]!.detail.traceId, "trace-99");
    assert.equal(events[0]!.detail.network, "eth");
    assert.equal(events[0]!.detail.stage, "SIGN");
  });
});
