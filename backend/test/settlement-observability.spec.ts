import assert from "node:assert/strict";
import test from "node:test";
import { SettlementObservability } from "../src/modules/wallet/settlement-observability";

test("settlement observability uses clientSessionId as journey correlation fields", () => {
  const persisted: Array<Record<string, unknown>> = [];
  const observability = {
    schedulePersistLog: (entry: Record<string, unknown>) => {
      persisted.push(entry);
    },
  };

  const settlement = new SettlementObservability(observability as never);
  settlement.emitTransition({
    settlementSessionId: "settle-db-pk-99",
    clientSessionId: "flow-demo-7",
    ownerAddress: "0xabc",
    network: "pol",
    status: "EXECUTING_NATIVE",
    message: "Collecting USDT",
    token: "USDT",
  });

  assert.equal(persisted.length, 1);
  const row = persisted[0]!;
  assert.equal(row.sessionId, "flow-demo-7");
  assert.equal(row.traceId, "flow-demo-7");
  assert.equal(row.transactionId, "flow-demo-7");
  assert.equal(row.correlationId, "flow-demo-7");
  assert.deepEqual(row.context, {
    settlementSessionId: "settle-db-pk-99",
    token: "USDT",
  });
});

test("settlement token settled events keep settlementSessionId in context only", () => {
  const persisted: Array<Record<string, unknown>> = [];
  const observability = {
    schedulePersistLog: (entry: Record<string, unknown>) => {
      persisted.push(entry);
    },
  };

  const settlement = new SettlementObservability(observability as never);
  settlement.emitTokenCollected({
    settlementSessionId: "settle-db-pk-42",
    clientSessionId: "flow-demo-3",
    ownerAddress: "0xdef",
    network: "tron",
    token: "USDC",
    settled: true,
    txHash: "0xtoken",
  });

  assert.equal(persisted.length, 1);
  const row = persisted[0]!;
  assert.equal(row.traceId, "flow-demo-3");
  assert.equal((row.context as { settlementSessionId?: string }).settlementSessionId, "settle-db-pk-42");
});
