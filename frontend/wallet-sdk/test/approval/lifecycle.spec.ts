import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApprovalOrchestrator } from "../../src/approval/orchestrator";
import { ApprovalStageName, StageStatus } from "../../src/approval/types";
import {
  ApprovalLifecycleState,
  InMemoryLifecycleStore,
  buildCheckpoint,
  restoreContextFromCheckpoint,
} from "../../src/approval/lifecycle";
import { TransactionConfirmationStatus } from "../../src/approval/confirmation/types";
import { ResourceStatus } from "../../src/core/resource-sponsor-client";
import {
  createFakeApi,
  createFakeChain,
  fakePrepared,
  resourceResult,
} from "./fakes";

const baseRequest = {
  network: "tron",
  owner: "TOwner",
  token: "USDT",
  amountHuman: "1",
  unlimited: false,
  nativeBalanceHuman: "0",
  tokenBalanceHuman: "10",
  traceId: "test-trace",
};

describe("Approval lifecycle + resume", () => {
  it("saves checkpoints and resumes from WAIT_CONFIRMATION without re-broadcast", async () => {
    const store = new InMemoryLifecycleStore();
    const api = createFakeApi();
    let broadcasts = 0;
    const chain = createFakeChain("tron", {
      confirmationSequence: [
        {
          status: TransactionConfirmationStatus.CONFIRMED,
          txHash: "0xabc",
          confirmations: 1,
        },
      ],
    });
    const origBroadcast = chain.broadcast.bind(chain);
    chain.broadcast = async (args) => {
      broadcasts += 1;
      return origBroadcast(args);
    };

    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      lifecycleStore: store,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const checkpoint = buildCheckpoint({
      ctx: {
        request: { ...baseRequest, traceId: "resume-1" },
        stageLog: [],
        prepared: fakePrepared(),
        broadcast: { txHash: "0xabc" },
        lifecycleState: ApprovalLifecycleState.BROADCAST,
      },
      lifecycleState: ApprovalLifecycleState.CONFIRMING,
      resumeFromStage: ApprovalStageName.WAIT_CONFIRMATION,
    });
    store.save(checkpoint);

    const result = await orch.run(baseRequest, {
      checkpoint,
      lifecycleStore: store,
      confirmation: { pollIntervalMs: 1, maxAttempts: 3 },
    });

    assert.equal(result.ok, true);
    assert.equal(broadcasts, 0);
    assert.equal(api.state.verifyAllowanceCalls, 1);
    assert.equal(api.state.persistCalls, 1);
    assert.equal(result.context.confirmation?.confirmed, true);
  });

  it("verify fails when confirmation incomplete", async () => {
    const { verifyApprovalStage } =
      await import("../../src/approval/stages/verify-approval");
    const api = createFakeApi();
    const ctx = {
      request: baseRequest,
      stageLog: [],
      prepared: fakePrepared(),
      broadcast: { txHash: "0xabc" },
      confirmation: { txHash: "0xabc", waitedMs: 0, confirmed: false },
    };
    const result = await verifyApprovalStage.run(ctx, {
      api,
      resolveChain: () => createFakeChain(),
    });
    assert.equal(result.status, StageStatus.FAILED);
    assert.equal(api.state.verifyAllowanceCalls, 0);
  });

  it("polls allowance after confirmation before persist", async () => {
    const api = createFakeApi();
    api.state.verifyAllowanceSequence = [
      { hasAllowance: false, allowance: "0" },
      { hasAllowance: true, allowance: "1000000" },
    ];
    const chain = createFakeChain("tron", {
      confirmationSequence: [
        { status: TransactionConfirmationStatus.PENDING, txHash: "0xabc" },
        {
          status: TransactionConfirmationStatus.CONFIRMED,
          txHash: "0xabc",
          confirmations: 1,
        },
      ],
    });

    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, {
      confirmation: { pollIntervalMs: 1, maxAttempts: 5 },
    });

    assert.equal(result.ok, true);
    assert.ok(api.state.verifyAllowanceCalls >= 2);
    assert.equal(api.state.persistCalls, 1);
  });

  it("restoreContextFromCheckpoint preserves broadcast + confirmation", () => {
    const ctx = restoreContextFromCheckpoint({
      checkpointId: "tron:TOwner:USDT:0xabc",
      lifecycleState: ApprovalLifecycleState.CONFIRMED,
      resumeFromStage: ApprovalStageName.VERIFY_APPROVAL,
      request: baseRequest,
      context: {
        prepared: fakePrepared(),
        broadcast: { txHash: "0xabc" },
        confirmation: {
          txHash: "0xabc",
          waitedMs: 100,
          confirmed: true,
          confirmations: 1,
        },
      },
      updatedAt: new Date().toISOString(),
    });
    assert.equal(ctx.broadcast?.txHash, "0xabc");
    assert.equal(ctx.confirmation?.confirmed, true);
  });

  it("clears checkpoint on successful completion", async () => {
    const store = new InMemoryLifecycleStore();
    const api = createFakeApi();
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      lifecycleStore: store,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, {
      lifecycleStore: store,
      confirmation: { pollIntervalMs: 1, maxAttempts: 2 },
    });
    assert.equal(result.ok, true);
    assert.equal(store.list().length, 0);
  });

  it("retains checkpoint on confirmation timeout for resume", async () => {
    const store = new InMemoryLifecycleStore();
    const api = createFakeApi();
    const chain = createFakeChain("tron", {
      confirmationSequence: [
        { status: TransactionConfirmationStatus.PENDING, txHash: "0xabc" },
      ],
    });

    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      lifecycleStore: store,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, {
      lifecycleStore: store,
      confirmation: { pollIntervalMs: 1, maxAttempts: 2 },
    });

    assert.equal(result.ok, false);
    assert.equal(result.failedStage, ApprovalStageName.WAIT_CONFIRMATION);
    assert.ok(store.list().length >= 1);
    const cp =
      store
        .list()
        .find(
          (c) => c.resumeFromStage === ApprovalStageName.WAIT_CONFIRMATION,
        ) ??
      store.list().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    assert.equal(cp.resumeFromStage, ApprovalStageName.WAIT_CONFIRMATION);
    assert.equal(cp.context.broadcast?.txHash, "0xabc");
  });
});
