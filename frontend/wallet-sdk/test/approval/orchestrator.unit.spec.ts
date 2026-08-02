import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApprovalOrchestrator } from "../../src/approval/orchestrator";
import { ApprovalStageName, StageStatus } from "../../src/approval/types";
import { ResourceStatus } from "../../src/core/resource-sponsor-client";
import { TransactionConfirmationStatus } from "../../src/approval/confirmation/types";
import { createFakeApi, createFakeChain, resourceResult } from "./fakes";

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

describe("ApprovalOrchestrator unit", () => {
  it("runs all nine stages successfully", async () => {
    const api = createFakeApi();
    const stages: string[] = [];
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, {
      onStage: (r) => stages.push(r.stage),
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, StageStatus.OK);
    assert.equal(result.txHash, "0xabc");
    assert.equal(result.approvalId, "appr_1");
    assert.deepEqual(stages, [
      ApprovalStageName.PREPARE,
      ApprovalStageName.ACQUIRE_RESOURCES,
      ApprovalStageName.WAIT_RESOURCES_READY,
      ApprovalStageName.SIGN,
      ApprovalStageName.BROADCAST,
      ApprovalStageName.WAIT_CONFIRMATION,
      ApprovalStageName.VERIFY_APPROVAL,
      ApprovalStageName.PERSIST_APPROVAL,
      ApprovalStageName.POST_APPROVAL,
    ]);
    assert.equal(api.state.prepareCalls, 1);
    assert.equal(api.state.verifyAllowanceCalls, 1);
    assert.equal(api.state.persistCalls, 1);
    assert.equal(api.state.postCalls, 1);
  });

  it("stops at prepare failure with typed stage result", async () => {
    const api = createFakeApi();
    api.state.failPrepare = true;
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest);
    assert.equal(result.ok, false);
    assert.equal(result.failedStage, ApprovalStageName.PREPARE);
    assert.equal(result.status, StageStatus.FAILED);
    assert.match(result.error ?? "", /prepare boom/);
    assert.equal(api.state.acquireCalls, 0);
  });

  it("fails acquire when resources denied and no native balance", async () => {
    const api = createFakeApi();
    api.state.acquireSequence = [
      resourceResult(ResourceStatus.INSUFFICIENT_RESOURCES, {
        message: "no energy",
      }),
    ];
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run({ ...baseRequest, nativeBalanceHuman: "0" });
    assert.equal(result.ok, false);
    assert.equal(result.failedStage, ApprovalStageName.ACQUIRE_RESOURCES);
    assert.match(result.error ?? "", /no energy/);
  });

  it("continues when acquire fails but Tron native can cover fee limit", async () => {
    const api = createFakeApi();
    api.state.acquireSequence = [
      resourceResult(ResourceStatus.PROVIDER_UNAVAILABLE, {
        message: "sponsor down",
      }),
    ];
    api.state.verifySequence = [
      resourceResult(ResourceStatus.PROVIDER_UNAVAILABLE),
    ];
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run({
      ...baseRequest,
      nativeBalanceHuman: "200",
    });
    assert.equal(result.ok, true);
    assert.equal(result.txHash, "0xabc");
  });

  it("fails acquire when Tron native balance cannot cover fee limit", async () => {
    const api = createFakeApi();
    api.state.acquireSequence = [
      resourceResult(ResourceStatus.PROVIDER_UNAVAILABLE, {
        message: "sponsor down",
      }),
    ];
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run({
      ...baseRequest,
      nativeBalanceHuman: "9.750144",
    });
    assert.equal(result.ok, false);
    assert.equal(result.failedStage, ApprovalStageName.ACQUIRE_RESOURCES);
    assert.match(result.error ?? "", /sponsor down/);
    assert.equal(api.state.verifyCalls, 0);
  });

  it("polls PENDING resources until READY", async () => {
    const api = createFakeApi();
    api.state.acquireSequence = [
      resourceResult(ResourceStatus.PENDING, { retryAfterMs: 1 }),
    ];
    api.state.verifySequence = [
      resourceResult(ResourceStatus.PENDING),
      resourceResult(ResourceStatus.READY),
    ];
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest);
    assert.equal(result.ok, true);
    assert.ok(api.state.verifyCalls >= 2);
  });

  it("marks user rejection on sign without retrying forever", async () => {
    const api = createFakeApi();
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain("tron", { userReject: true })],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, { maxStageRetries: 3 });
    assert.equal(result.ok, false);
    assert.equal(result.failedStage, ApprovalStageName.SIGN);
    assert.equal(result.userRejected, true);
    assert.equal(api.state.verifyAllowanceCalls, 0);
    assert.equal(api.state.persistCalls, 0);
  });

  it("retries retryable broadcast failures", async () => {
    let broadcasts = 0;
    const api = createFakeApi();
    const chain = createFakeChain();
    const origBroadcast = chain.broadcast.bind(chain);
    chain.broadcast = async (args) => {
      broadcasts += 1;
      if (broadcasts === 1) throw new Error("temporary node error");
      return origBroadcast(args);
    };
    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, { maxStageRetries: 2 });
    assert.equal(result.ok, true);
    assert.equal(broadcasts, 2);
  });

  it("cancels mid-flight when AbortSignal aborts", async () => {
    const api = createFakeApi();
    const controller = new AbortController();
    const chain = createFakeChain();
    chain.sign = async () => {
      controller.abort();
      await new Promise((r) => setTimeout(r, 5));
      return { network: "tron", payload: {} };
    };
    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, { signal: controller.signal });
    assert.equal(result.ok, false);
    assert.ok(
      result.status === StageStatus.CANCELLED ||
        result.failedStage === ApprovalStageName.SIGN ||
        result.failedStage === ApprovalStageName.BROADCAST
    );
  });

  it("soft-fails POST_APPROVAL without failing the run", async () => {
    const api = createFakeApi();
    api.postApprovalLog = async () => {
      throw new Error("tg down");
    };
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest);
    assert.equal(result.ok, true);
    const post = result.stages.find(
      (s) => s.stage === ApprovalStageName.POST_APPROVAL
    );
    assert.equal(post?.status, StageStatus.FAILED);
  });

  it("fails verify when allowance missing after confirmation", async () => {
    const api = createFakeApi();
    api.state.verifyAllowanceSequence = [{ hasAllowance: false, allowance: "0" }];
    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, {
      confirmation: { pollIntervalMs: 1, maxAttempts: 2 },
      verifyAllowanceAttempts: 1,
      maxStageRetries: 0,
    });
    assert.equal(result.ok, false);
    assert.equal(result.failedStage, ApprovalStageName.VERIFY_APPROVAL);
    assert.ok(api.state.verifyAllowanceCalls >= 1);
    assert.equal(api.state.persistCalls, 0);
  });

  it("polls confirmation before verify", async () => {
    const api = createFakeApi();
    let confirmPolls = 0;
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
    const orig = chain.getTransactionStatus.bind(chain);
    chain.getTransactionStatus = async (args) => {
      confirmPolls += 1;
      return orig(args);
    };

    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, {
      confirmation: { pollIntervalMs: 1, maxAttempts: 5 },
    });
    assert.equal(result.ok, true);
    assert.ok(confirmPolls >= 2);
    assert.equal(result.context.confirmation?.confirmed, true);
  });
});
