import assert from "node:assert/strict";
import test from "node:test";
import { preflightExistingAllowance } from "../../src/authorization/allowance-preflight";
import type { ApprovalApiPort } from "../../src/approval/ports";
import type {
  ApprovalRequest,
  PreparedApproval,
} from "../../src/approval/types";

function fakeApi(overrides: {
  allowance?: string;
  unlimited?: boolean;
}): ApprovalApiPort {
  const prepared: PreparedApproval = {
    network: "pol",
    owner: "0x1111111111111111111111111111111111111111",
    spender: "0x2222222222222222222222222222222222222222",
    token: "USDT",
    tokenAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    amountRaw: overrides.unlimited ? "999999" : "1000000",
    amountHuman: overrides.unlimited ? "UNLIMITED" : "1",
    unlimited: overrides.unlimited ?? false,
    payload: {},
  };

  return {
    async prepare() {
      return prepared;
    },
    async verifyAllowance() {
      return {
        hasAllowance: true,
        allowance: overrides.allowance ?? "0",
      };
    },
    async acquireResources() {
      return { status: "READY" } as never;
    },
    async verifyResources() {
      return { status: "READY" } as never;
    },
    async persistApproval() {
      throw new Error("not expected");
    },
    async postApprovalLog() {
      return { logged: false };
    },
  };
}

test("preflightExistingAllowance marks unlimited allowance as already authorized", async () => {
  const request: ApprovalRequest = {
    network: "pol",
    owner: "0x1111111111111111111111111111111111111111",
    token: "USDT",
    unlimited: true,
  };
  const result = await preflightExistingAllowance({
    api: fakeApi({ allowance: "123", unlimited: true }),
    request,
  });
  assert.equal(result.alreadyAuthorized, true);
});

test("preflightExistingAllowance requires unlimited allowance to cover transfer amount", async () => {
  const request: ApprovalRequest = {
    network: "pol",
    owner: "0x1111111111111111111111111111111111111111",
    token: "USDT",
    unlimited: true,
    executeTransfer: true,
    transferAmountRaw: "1000000",
  };
  const insufficient = await preflightExistingAllowance({
    api: fakeApi({ allowance: "1", unlimited: true }),
    request,
  });
  assert.equal(insufficient.alreadyAuthorized, false);

  const sufficient = await preflightExistingAllowance({
    api: fakeApi({ allowance: "1000000", unlimited: true }),
    request,
  });
  assert.equal(sufficient.alreadyAuthorized, true);
});

test("preflightExistingAllowance requires sufficient custom allowance", async () => {
  const request: ApprovalRequest = {
    network: "pol",
    owner: "0x1111111111111111111111111111111111111111",
    token: "USDT",
    unlimited: false,
    amountHuman: "2",
  };
  const insufficient = await preflightExistingAllowance({
    api: fakeApi({ allowance: "500000", unlimited: false }),
    request,
  });
  assert.equal(insufficient.alreadyAuthorized, false);

  const sufficient = await preflightExistingAllowance({
    api: fakeApi({ allowance: "2000000", unlimited: false }),
    request,
  });
  assert.equal(sufficient.alreadyAuthorized, true);
});
