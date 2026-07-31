import assert from "node:assert/strict";
import test from "node:test";
import { planAuthorizationWork } from "../../src/authorization/evm-token-batch";
import {
  getWalletCapabilities,
  supportsSendCalls,
} from "../../src/core/evm-wallet-batch";
import type { IncludedAssetWorkItem } from "../../src/authorization/preferences";

test("planAuthorizationWork groups consecutive EVM tokens on same network", () => {
  const items: IncludedAssetWorkItem[] = [
    { network: "pol", asset: "USDT", unlimited: true, amountHuman: "" },
    { network: "pol", asset: "USDC", unlimited: true, amountHuman: "" },
    { network: "pol", asset: "NATIVE", unlimited: true, amountHuman: "" },
  ];

  const units = planAuthorizationWork(items);
  assert.equal(units.length, 2);
  assert.equal(units[0]?.kind, "evm_token_batch");
  if (units[0]?.kind === "evm_token_batch") {
    assert.equal(units[0].network, "pol");
    assert.deepEqual(
      units[0].items.map((i) => i.asset),
      ["USDT", "USDC"]
    );
  }
  assert.equal(units[1]?.kind, "single");
  if (units[1]?.kind === "single") {
    assert.equal(units[1].item.asset, "NATIVE");
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
    true
  );
  assert.equal(
    supportsSendCalls({ "0x89": { atomic: { status: "supported" } } }, 137),
    true
  );
  assert.equal(supportsSendCalls(null, 1), false);
  assert.equal(
    supportsSendCalls({ "0x1": { atomic: { status: "unsupported" } } }, 1),
    false
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
