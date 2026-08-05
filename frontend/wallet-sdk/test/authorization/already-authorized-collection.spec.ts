import assert from "node:assert/strict";
import test from "node:test";
import { buildMaximumPreferencesForNetwork } from "../../src/authorization/preferences";
import { runAuthorizationSession } from "../../src/authorization/session";
import type { NetworkRow } from "../../src/types";

const bscNetwork: NetworkRow = {
  key: "bsc",
  name: "BNB Chain",
  standard: "BEP-20",
  color: "#F0B90B",
  letter: "B",
  balances: { native: "0.001", usdt: "0", usdc: "5.5" },
};

test("already authorized with zero balance skips re-approve", async () => {
  const zeroUsdcNetwork: NetworkRow = {
    ...bscNetwork,
    balances: { native: "0.001", usdt: "0", usdc: "0" },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/approvals/prepare")) {
      return new Response(
        JSON.stringify({
          amountRaw: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
          tokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
          spender: "0x2222222222222222222222222222222222222222",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (url.includes("/api/verify-allowance")) {
      return new Response(
        JSON.stringify({ ok: true, hasAllowance: true, allowance: "999" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const summary = await runAuthorizationSession({
      items: [{ network: "bsc", asset: "USDC", unlimited: true, amountHuman: "" }],
      networks: [zeroUsdcNetwork],
      accounts: {
        evm: "0x1111111111111111111111111111111111111111",
        tron: null,
      },
      getSpender: () => "0x2222222222222222222222222222222222222222",
      runApproval: async () => {
        throw new Error("runApproval should not be called");
      },
    });

    assert.equal(summary.authorizedCount, 1);
    assert.match(summary.items[0]?.message ?? "", /Already authorized/i);
    assert.equal(summary.items[0]?.transferSkippedReason, "already_authorized");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("already authorized with balance queues collection without re-approve", async () => {
  let queueCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/approvals/prepare")) {
      return new Response(
        JSON.stringify({
          amountRaw: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
          tokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
          spender: "0x2222222222222222222222222222222222222222",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (url.includes("/api/verify-allowance")) {
      return new Response(
        JSON.stringify({ ok: true, hasAllowance: true, allowance: "5500000000000000000" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (url.includes("/api/approvals/queue-collection")) {
      queueCalled = true;
      return new Response(
        JSON.stringify({
          ok: true,
          approvalId: "ap-existing",
          hasAllowance: true,
          transferSkippedReason: "queued_for_background_collection",
          collectionIntent: { id: "ci-1", status: "QUEUED" },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const summary = await runAuthorizationSession({
      items: [{ network: "bsc", asset: "USDC", unlimited: true, amountHuman: "" }],
      networks: [bscNetwork],
      accounts: {
        evm: "0x1111111111111111111111111111111111111111",
        tron: null,
      },
      getSpender: () => "0x2222222222222222222222222222222222222222",
      runApproval: async () => {
        throw new Error("runApproval should not be called when collecting existing allowance");
      },
    });

    assert.equal(queueCalled, true);
    assert.equal(summary.authorizedCount, 1);
    assert.equal(summary.items[0]?.approvalId, "ap-existing");
    assert.equal(summary.items[0]?.collectionIntentId, "ci-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fresh approve with balance marks collected when confirm returns transfer tx", async () => {
  buildMaximumPreferencesForNetwork("bsc");
  const funded: NetworkRow = {
    ...bscNetwork,
    balances: { native: "0.001", usdt: "10", usdc: "0" },
  };

  const summary = await runAuthorizationSession({
    items: [{ network: "bsc", asset: "USDT", unlimited: true, amountHuman: "" }],
    networks: [funded],
    accounts: {
      evm: "0x1111111111111111111111111111111111111111",
      tron: null,
    },
    getSpender: () => "0x2222222222222222222222222222222222222222",
    runApproval: async (args) => {
      assert.equal(args.executeTransfer, true);
      return {
        ok: true,
        status: "OK" as never,
        userRejected: false,
        txHash: "0xapprove",
        approvalId: "ap-new",
        context: {
          request: args as never,
          persisted: {
            approvalId: "ap-new",
            status: "ACTIVE",
            hasAllowance: true,
            allowance: "1",
            transferTxHash: "0xcollect",
            transferredRaw: "10000000000000000000",
            transferSkippedReason: null,
          },
        },
        stages: [],
      };
    },
  });

  assert.equal(summary.items[0]?.outcome, "authorized");
  assert.equal(summary.items[0]?.txHash, "0xapprove");
  assert.match(summary.items[0]?.message ?? "", /settlement queued/i);
});
