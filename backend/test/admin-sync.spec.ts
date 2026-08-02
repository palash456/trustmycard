import assert from "node:assert/strict";
import test from "node:test";
import { CollectionIntentStatus } from "@prisma/client";
import { CollectionIntentService } from "../src/modules/collections/collection-intent.service";

test("collection intent creation emits admin sync events", async () => {
  const emitted: Array<Record<string, unknown>> = [];
  const adminEvents = {
    collectionIntentUpdated(payload: Record<string, unknown>) {
      emitted.push(payload);
    },
  };

  const service = new CollectionIntentService(
    { record: async () => ({ id: "outbox-1" }) } as never,
    {} as never,
    adminEvents as never
  );

  const tx = {
    collectionIntent: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "intent-1", ...data }),
    },
  };

  const result = await service.createForApproval(tx as never, {
    approvalId: "approval-1",
    ownerAddress: "0xowner",
    spenderAddress: "0xspender",
    network: "eth",
    tokenSymbol: "USDT",
    tokenAddress: "0xabc",
    requestedRaw: "100",
    sourceTxHash: "0xtx",
  });

  assert.equal(result.intent.id, "intent-1");
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0], {
    id: "intent-1",
    approvalId: "approval-1",
    ownerAddress: "0xowner",
    status: CollectionIntentStatus.QUEUED,
    network: "eth",
    attemptId: undefined,
    txHash: null,
  });
});
