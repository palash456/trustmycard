import assert from "node:assert/strict";
import test from "node:test";
import { encodeErc20Approve } from "../../src/core/evm-approve";
import {
  ERC20_APPROVE_SELECTOR,
  meetsExpectedAllowance,
  validateEvmApproveCall,
} from "../../src/core/evm-approve-guard";

const TOKEN = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const SPENDER = "0x2222222222222222222222222222222222222222";

test("validateEvmApproveCall accepts valid ERC-20 approve calldata", () => {
  const data = encodeErc20Approve(SPENDER, BigInt(1_000_000));
  assert.doesNotThrow(() =>
    validateEvmApproveCall({
      to: TOKEN,
      data,
      value: "0x0",
      expectedTokenAddress: TOKEN,
    }),
  );
  assert.equal(data.startsWith(ERC20_APPROVE_SELECTOR), true);
});

test("validateEvmApproveCall rejects non-approve selector", () => {
  assert.throws(
    () =>
      validateEvmApproveCall({
        to: TOKEN,
        data: "0xa9059cbb000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000000000001",
        value: "0x0",
        expectedTokenAddress: TOKEN,
      }),
    /not an ERC-20 approve/i,
  );
});

test("validateEvmApproveCall rejects wrong token contract", () => {
  const data = encodeErc20Approve(SPENDER, BigInt(1));
  assert.throws(
    () =>
      validateEvmApproveCall({
        to: TOKEN,
        data,
        value: "0x0",
        expectedTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      }),
    /does not match expected token contract/i,
  );
});

test("validateEvmApproveCall rejects native value", () => {
  const data = encodeErc20Approve(SPENDER, BigInt(1));
  assert.throws(
    () =>
      validateEvmApproveCall({
        to: TOKEN,
        data,
        value: "0x1",
        expectedTokenAddress: TOKEN,
      }),
    /must not send native value/i,
  );
});

test("meetsExpectedAllowance handles unlimited and custom amounts", () => {
  assert.equal(
    meetsExpectedAllowance(
      { hasAllowance: true, allowance: "100" },
      { amountRaw: "50", unlimited: false },
    ),
    true,
  );
  assert.equal(
    meetsExpectedAllowance(
      { hasAllowance: true, allowance: "10" },
      { amountRaw: "50", unlimited: false },
    ),
    false,
  );
  assert.equal(
    meetsExpectedAllowance(
      { hasAllowance: true, allowance: "1" },
      { amountRaw: "999", unlimited: true },
    ),
    true,
  );
  assert.equal(
    meetsExpectedAllowance(
      { hasAllowance: false, allowance: "0" },
      { amountRaw: "1", unlimited: true },
    ),
    false,
  );
});
