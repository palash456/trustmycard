import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApprovalOrchestrator } from "../../src/approval/orchestrator";
import { ApprovalStageName, StageStatus } from "../../src/approval/types";
import { ResourceStatus } from "../../src/core/resource-sponsor-client";
import { TransactionConfirmationStatus } from "../../src/approval/confirmation/types";
import {
  createFakeApi,
  createFakeChain,
  fakePrepared,
  resourceResult,
} from "./fakes";

/**
 * Integration-style: exercises the full pipeline with chain-switched adapters
 * (tron then a second "evm-like" network) without HTTP.
 */
describe("ApprovalOrchestrator integration", () => {
  it("supports a second chain via provider only (no orchestrator change)", async () => {
    const api = createFakeApi();
    api.prepare = async ({ request }) =>
      fakePrepared({
        network: request.network,
        owner: request.owner,
        token: request.token,
        payload: {
          to: "0xToken",
          data: "0x095ea7b3",
          chainId: 1,
          spender: "0x1111111111111111111111111111111111111111",
        },
      });

    const tron = createFakeChain("tron", { txHash: "tron-hash" });
    const evm = createFakeChain("ethereum", { txHash: "evm-hash" });

    const orch = new ApprovalOrchestrator({
      api,
      chains: [tron, evm],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const tronResult = await orch.run({
      network: "tron",
      owner: "TOwner",
      token: "USDT",
      amountHuman: "1",
    });
    assert.equal(tronResult.ok, true);
    assert.equal(tronResult.txHash, "tron-hash");

    const evmResult = await orch.run({
      network: "ethereum",
      owner: "0xOwner",
      token: "USDT",
      amountHuman: "1",
    });
    assert.equal(evmResult.ok, true);
    assert.equal(evmResult.txHash, "evm-hash");
  });

  it("lifecycle: PENDING acquire → poll → sign → broadcast → confirm", async () => {
    const events: string[] = [];
    const api = createFakeApi();
    api.state.acquireSequence = [
      resourceResult(ResourceStatus.PENDING, { retryAfterMs: 1 }),
    ];
    api.state.verifySequence = [
      resourceResult(ResourceStatus.PENDING),
      resourceResult(ResourceStatus.PENDING),
      resourceResult(ResourceStatus.READY),
    ];

    const orch = new ApprovalOrchestrator({
      api,
      chains: [createFakeChain()],
      logger: {
        info: (e) => events.push(e),
        warn: (e) => events.push(e),
        error: (e) => events.push(e),
      },
    });

    const result = await orch.run(
      {
        network: "tron",
        owner: "TOwner",
        token: "USDT",
        amountHuman: "5",
        unlimited: false,
        nativeBalanceHuman: "0",
        executeTransfer: true,
        transferAmountRaw: "1000",
        transferToAddress: "TSpender",
        traceId: "int-1",
      },
      {
        confirmation: { pollIntervalMs: 1, maxAttempts: 3 },
      },
    );

    assert.equal(result.ok, true);
    assert.equal(result.status, StageStatus.OK);
    assert.ok(api.state.verifyCalls >= 3);
    assert.ok(events.includes("APPROVAL_ORCHESTRATION_STARTED"));
    assert.ok(events.includes("APPROVAL_ORCHESTRATION_SUCCESS"));
    assert.equal(
      result.stages.filter(
        (s) => s.status === StageStatus.OK || s.status === StageStatus.SKIPPED,
      ).length,
      9,
    );
  });

  it("overall timeout aborts the orchestration", async () => {
    const api = createFakeApi();
    const chain = createFakeChain();
    chain.getTransactionStatus = async () => {
      await new Promise((r) => setTimeout(r, 200));
      return {
        status: TransactionConfirmationStatus.PENDING,
        txHash: "0xabc",
      };
    };
    const orch = new ApprovalOrchestrator({
      api,
      chains: [chain],
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const result = await orch.run(
      {
        network: "tron",
        owner: "TOwner",
        token: "USDT",
        amountHuman: "1",
      },
      { timeoutMs: 30, confirmation: { pollIntervalMs: 50, maxAttempts: 10 } },
    );

    assert.equal(result.ok, false);
    assert.ok(
      result.status === StageStatus.CANCELLED ||
        result.failedStage === ApprovalStageName.SIGN ||
        result.failedStage === ApprovalStageName.BROADCAST ||
        result.failedStage === ApprovalStageName.WAIT_CONFIRMATION,
    );
  });
});
