import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  CORRELATION_ID_HEADER,
  assignJourneyId,
  beginTransaction,
  clearActiveTransaction,
  correlationHeaders,
  getActiveTransaction,
  isActiveTransactionExpired,
  markTerminal,
  reconcileActiveTransactionOnMount,
  setActiveTransaction,
} from "../../src/core/transaction-context";

function installSessionStorage() {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  (globalThis as { sessionStorage?: typeof sessionStorage }).sessionStorage =
    sessionStorage;
  return store;
}

describe("transaction-context", () => {
  beforeEach(() => {
    installSessionStorage();
    clearActiveTransaction();
  });

  afterEach(() => {
    clearActiveTransaction();
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });

  it("assignJourneyId returns semantic flow-* with wallet suffix", () => {
    const record = assignJourneyId("0x742d35Cc6634C0532925a8b8C4a8F92C", {
      network: "pol",
      collisionSuffix: undefined,
    });
    assert.match(record.transactionId, /^flow-\d{8}-\d{6}-A8F92C$/);
    assert.equal(record.walletAddress, "0x742d35Cc6634C0532925a8b8C4a8F92C");
  });

  it("correlationHeaders sets x-correlation-id when id provided", () => {
    assert.deepEqual(correlationHeaders("flow-20260809-142315-A8F92C"), {
      [CORRELATION_ID_HEADER]: "flow-20260809-142315-A8F92C",
    });
    assert.deepEqual(correlationHeaders(), {});
    assert.deepEqual(correlationHeaders("  "), {});
  });

  it("beginTransaction without wallet defers flow ID", () => {
    const record = beginTransaction();
    assert.equal(record.transactionId, "");
    assert.ok(record.startedAt);
  });

  it("beginTransaction with wallet mints immediately", () => {
    const record = beginTransaction({
      walletAddress: "0x742d35Cc6634C0532925a8b8C4a8F92C",
      network: "pol",
    });
    assert.match(record.transactionId, /^flow-\d{8}-\d{6}-A8F92C$/);
  });

  it("markTerminal updates terminal status without clearing record", () => {
    assignJourneyId("0xabc");
    const updated = markTerminal("SUCCESS");
    assert.equal(updated?.terminalStatus, "SUCCESS");
    assert.equal(getActiveTransaction()?.terminalStatus, "SUCCESS");
  });

  it("reconcileActiveTransactionOnMount resumes in-progress transaction", () => {
    const record = assignJourneyId("0x742d35Cc6634C0532925a8b8C4a8F92C");
    const reconciled = reconcileActiveTransactionOnMount();
    assert.equal(reconciled.transactionId, record.transactionId);
    assert.equal(reconciled.expired, false);
  });

  it("reconcileActiveTransactionOnMount marks expired stale transactions", () => {
    const stale = setActiveTransaction({
      transactionId: "flow-stale",
      startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(isActiveTransactionExpired(stale), true);
    const reconciled = reconcileActiveTransactionOnMount();
    assert.equal(reconciled.expired, true);
    assert.equal(reconciled.transactionId, null);
    assert.equal(getActiveTransaction()?.terminalStatus, "EXPIRED");
  });

  it("reconcileActiveTransactionOnMount ignores terminal records", () => {
    assignJourneyId("0xabc");
    markTerminal("CANCELLED");
    const reconciled = reconcileActiveTransactionOnMount();
    assert.equal(reconciled.transactionId, null);
    assert.equal(reconciled.expired, false);
  });
});
