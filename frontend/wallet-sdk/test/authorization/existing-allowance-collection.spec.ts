import assert from "node:assert/strict";
import test from "node:test";
import { authorizationResultFromQueueCollection } from "../../src/authorization/existing-allowance-collection";

test("authorizationResultFromQueueCollection maps transfer to collected outcome", () => {
  const result = authorizationResultFromQueueCollection({
    item: { network: "pol", asset: "USDT", unlimited: true, amountHuman: "" },
    json: {
      ok: true,
      approvalId: "ap-1",
      transfer: { txHash: "0xabc", transferredRaw: "1000000" },
      transferSkippedReason: null,
    },
  });

  assert.equal(result.outcome, "collected");
  assert.equal(result.txHash, "0xabc");
  assert.match(result.message ?? "", /confirmed/i);
});

test("authorizationResultFromQueueCollection keeps authorized when collection deferred", () => {
  const result = authorizationResultFromQueueCollection({
    item: { network: "eth", asset: "USDC", unlimited: true, amountHuman: "" },
    json: {
      ok: true,
      approvalId: "ap-2",
      transferSkippedReason: "queued_for_background_collection",
      collectionIntent: { id: "ci-9", status: "QUEUED" },
    },
  });

  assert.equal(result.outcome, "authorized");
  assert.equal(result.collectionIntentId, "ci-9");
  assert.match(result.message ?? "", /Queued for background collection/i);
});
