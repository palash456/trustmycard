import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApprovalOrchestrator } from "../../src/approval/orchestrator";
import { ApprovalStageName, StageStatus } from "../../src/approval/types";
import { TransactionConfirmationStatus } from "../../src/approval/confirmation/types";
import { createFakeApi, createFakeChain } from "./fakes";

const baseRequest = {
  network: "tron",
  owner: "TOwner",
  token: "USDT",
  amountHuman: "1",
  traceId: "retry-test",
};

describe("orchestrator resilience", () => {
  it("uses backoff between stage retries", async () => {
    let broadcasts = 0;
    const api = createFakeApi();
    const chain = createFakeChain();
    const orig = chain.broadcast.bind(chain);
    chain.broadcast = async (args) => {
      broadcasts += 1;
      if (broadcasts === 1) throw new Error("503 gateway timeout");
      return orig(args);
    };

    const retryLogs: number[] = [];
    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: {
        info: () => {},
        warn: (_e, d) => {
          if (d?.delayMs != null) retryLogs.push(d.delayMs as number);
        },
        error: () => {},
      },
    });

    const result = await orch.run(baseRequest, {
      retryPolicies: {
        [ApprovalStageName.BROADCAST]: {
          maxAttempts: 3,
          baseDelayMs: 10,
          maxDelayMs: 50,
          multiplier: 2,
          jitterRatio: 0,
        },
      },
      confirmation: { pollIntervalMs: 1, maxAttempts: 2 },
    });

    assert.equal(result.ok, true);
    assert.equal(broadcasts, 2);
    assert.ok(retryLogs.length >= 1);
    assert.ok(retryLogs[0]! >= 10);
  });

  it("does not retry permanent sign errors", async () => {
    const api = createFakeApi();
    let signCalls = 0;
    const chain = createFakeChain("tron", { userReject: true });
    chain.sign = async (args) => {
      signCalls += 1;
      throw new Error("User rejected the request");
    };

    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(baseRequest, {
      retryPolicies: {
        [ApprovalStageName.SIGN]: {
          maxAttempts: 5,
          baseDelayMs: 1,
          maxDelayMs: 5,
          multiplier: 2,
          jitterRatio: 0,
        },
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.failedStage, ApprovalStageName.SIGN);
    assert.equal(signCalls, 1);
  });

  it("skips re-broadcast on resume when txHash checkpoint exists", async () => {
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
    chain.broadcast = async () => {
      broadcasts += 1;
      return { txHash: "0xabc" };
    };

    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(
      { ...baseRequest, traceId: "resume-bcast" },
      {
        checkpoint: {
          checkpointId: "tron:TOwner:USDT:resume-bcast",
          lifecycleState: "BROADCAST" as const,
          resumeFromStage: ApprovalStageName.WAIT_CONFIRMATION,
          request: { ...baseRequest, traceId: "resume-bcast" },
          context: {
            prepared: {
              network: "tron",
              owner: "TOwner",
              spender: "S",
              token: "USDT",
              tokenAddress: "T",
              amountRaw: "1",
              amountHuman: "1",
              unlimited: false,
              payload: {},
            },
            signed: { network: "tron", payload: {} },
            broadcast: { txHash: "0xabc" },
          },
          updatedAt: new Date().toISOString(),
        },
        confirmation: { pollIntervalMs: 1, maxAttempts: 2 },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(broadcasts, 0);
  });
});
