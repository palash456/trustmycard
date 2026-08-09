import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareStage } from "../../src/approval/stages/prepare";
import { acquireResourcesStage } from "../../src/approval/stages/acquire-resources";
import { signStage } from "../../src/approval/stages/sign";
import { ApprovalStageName, StageStatus } from "../../src/approval/types";
import type { ApprovalContext } from "../../src/approval/types";
import { ResourceStatus } from "../../src/core/resource-sponsor-client";
import { createFakeApi, createFakeChain, resourceResult } from "./fakes";

function emptyCtx(
  overrides: Partial<ApprovalContext["request"]> = {},
): ApprovalContext {
  return {
    request: {
      network: "tron",
      owner: "TOwner",
      token: "USDT",
      amountHuman: "1",
      nativeBalanceHuman: "0",
      ...overrides,
    },
    stageLog: [],
  };
}

describe("approval stages (isolated)", () => {
  it("prepareStage returns OK with prepared data", async () => {
    const api = createFakeApi();
    const ctx = emptyCtx();
    const result = await prepareStage.run(ctx, {
      api,
      resolveChain: () => createFakeChain(),
    });
    assert.equal(result.status, StageStatus.OK);
    assert.equal(result.stage, ApprovalStageName.PREPARE);
    assert.ok(ctx.prepared);
  });

  it("acquireResourcesStage fails without throwing", async () => {
    const api = createFakeApi();
    api.state.acquireSequence = [
      resourceResult(ResourceStatus.FAILED, { message: "x" }),
    ];
    const ctx = emptyCtx();
    ctx.prepared = (
      await prepareStage.run(ctx, {
        api,
        resolveChain: () => null,
      })
    ).data as ApprovalContext["prepared"];

    const result = await acquireResourcesStage.run(ctx, {
      api,
      resolveChain: () => null,
    });
    assert.equal(result.status, StageStatus.FAILED);
    assert.equal(typeof result.error, "string");
  });

  it("signStage returns userRejected flag", async () => {
    const api = createFakeApi();
    const ctx = emptyCtx();
    ctx.prepared = (
      await prepareStage.run(ctx, {
        api,
        resolveChain: () => createFakeChain(),
      })
    ).data as ApprovalContext["prepared"];

    const result = await signStage.run(ctx, {
      api,
      resolveChain: () => createFakeChain("tron", { userReject: true }),
    });
    assert.equal(result.status, StageStatus.FAILED);
    assert.equal(result.userRejected, true);
  });
});
