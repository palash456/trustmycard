import assert from "node:assert/strict";
import test from "node:test";
import { planAuthorizationWork } from "../../src/authorization/evm-token-batch";
import {
  getWalletCapabilities,
  supportsSendCalls,
} from "../../src/core/evm-wallet-batch";
import { shouldAttemptEip5792 } from "../../src/authorization/evm-token-batch-tiers";
import type { IncludedAssetWorkItem } from "../../src/authorization/preferences";

test("planAuthorizationWork groups consecutive EVM tokens and attaches native", () => {
  const items: IncludedAssetWorkItem[] = [
    { network: "pol", asset: "USDT", unlimited: true, amountHuman: "" },
    { network: "pol", asset: "USDC", unlimited: true, amountHuman: "" },
    { network: "pol", asset: "NATIVE", unlimited: true, amountHuman: "" },
  ];

  const units = planAuthorizationWork(items);
  assert.equal(units.length, 1);
  assert.equal(units[0]?.kind, "evm_token_batch");
  if (units[0]?.kind === "evm_token_batch") {
    assert.equal(units[0].network, "pol");
    assert.deepEqual(
      units[0].items.map((i) => i.asset),
      ["USDT", "USDC"],
    );
    assert.equal(units[0].nativeItem?.asset, "NATIVE");
  }
});

test("planAuthorizationWork does not batch Tron tokens", () => {
  const items: IncludedAssetWorkItem[] = [
    { network: "tron", asset: "USDT", unlimited: true, amountHuman: "" },
    { network: "tron", asset: "USDC", unlimited: true, amountHuman: "" },
  ];

  const units = planAuthorizationWork(items);
  assert.equal(units.length, 2);
  assert.ok(units.every((u) => u.kind === "single"));
});

test("planAuthorizationWork keeps single EVM token as single unit", () => {
  const items: IncludedAssetWorkItem[] = [
    { network: "eth", asset: "USDT", unlimited: true, amountHuman: "" },
  ];
  const units = planAuthorizationWork(items);
  assert.equal(units.length, 1);
  assert.equal(units[0]?.kind, "single");
});

test("supportsSendCalls detects atomic batch capability", () => {
  assert.equal(
    supportsSendCalls({ "0x1": { atomic: { status: "ready" } } }, 1),
    true,
  );
  assert.equal(
    supportsSendCalls({ "0x89": { atomic: { status: "supported" } } }, 137),
    true,
  );
  assert.equal(supportsSendCalls(null, 1), false);
  assert.equal(
    supportsSendCalls({ "0x1": { atomic: { status: "unsupported" } } }, 1),
    false,
  );
});

test("getWalletCapabilities returns null when wallet lacks the method", async () => {
  const provider = {
    request: async () => {
      throw new Error("method not found");
    },
  };
  const caps = await getWalletCapabilities(provider as never, 1, "0xabc");
  assert.equal(caps, null);
});

test("shouldAttemptEip5792 only probes when wallet advertises support", () => {
  assert.equal(
    shouldAttemptEip5792({ "0xa86a": { atomic: { status: "ready" } } }, 43114),
    true,
  );
  assert.equal(shouldAttemptEip5792(null, 43114), false);
  assert.equal(
    shouldAttemptEip5792(
      { "0xa86a": { atomic: { status: "unsupported" } } },
      43114,
    ),
    false,
  );
});
