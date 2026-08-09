import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNativeReadinessTokenInputs,
  waitForNativeExecutionAllowed,
} from "../../src/authorization/phases/settlement-coordinator";
import type { WalletPhaseTokenCapture } from "../../src/authorization/phases/types";

function mockCapture(
  asset: "USDT" | "USDC",
  shouldAttemptTransfer: boolean,
): WalletPhaseTokenCapture {
  return {
    item: {
      asset,
      unlimited: true,
      amountHuman: "1",
      network: "bsc",
      kind: "token",
    },
    orchestration: {
      ok: true,
      txHash: "0xabc",
      approvalId: `ap-${asset}`,
      context: {} as never,
      stages: [],
    },
    shouldAttemptTransfer,
  };
}

test("buildNativeReadinessTokenInputs preserves shouldAttemptTransfer from wallet phase", () => {
  const inputs = buildNativeReadinessTokenInputs([
    mockCapture("USDT", false),
    mockCapture("USDC", true),
  ]);
  assert.deepEqual(inputs, [
    {
      token: "USDT",
      shouldAttemptTransfer: false,
      approvalTxHash: "0xabc",
      approvalId: "ap-USDT",
    },
    {
      token: "USDC",
      shouldAttemptTransfer: true,
      approvalTxHash: "0xabc",
      approvalId: "ap-USDC",
    },
  ]);
});

test("waitForNativeExecutionAllowed resolves immediately when native is ready", async () => {
  let nudgeCalls = 0;
  let readinessCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/nudge")) {
      nudgeCalls += 1;
      return new Response(JSON.stringify({ ok: true, nudged: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    readinessCalls += 1;
    return new Response(
      JSON.stringify({
        canExecuteNative: true,
        tokens: [
          {
            token: "USDT",
            state: "skipped_zero_balance",
            stateLabel: "Skipped — zero balance",
            active: false,
          },
          {
            token: "USDC",
            state: "success",
            stateLabel: "Success",
            active: false,
          },
        ],
        blocking: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await waitForNativeExecutionAllowed({
      apiBaseUrl: "http://localhost:3000",
      owner: "0xowner",
      network: "bsc",
      tokenCaptures: [mockCapture("USDT", false), mockCapture("USDC", true)],
      pollMs: 1,
      timeoutMs: 500,
    });
    assert.equal(result.canExecuteNative, true);
    assert.equal(nudgeCalls, 1);
    assert.equal(readinessCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("waitForNativeExecutionAllowed waits until active collection finishes", async () => {
  let nudgeCalls = 0;
  let readinessCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/nudge")) {
      nudgeCalls += 1;
      return new Response(JSON.stringify({ ok: true, nudged: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    readinessCalls += 1;
    if (readinessCalls === 1) {
      return new Response(
        JSON.stringify({
          canExecuteNative: false,
          tokens: [
            {
              token: "USDT",
              state: "collecting",
              stateLabel: "Collecting / in progress",
              active: true,
            },
            {
              token: "USDC",
              state: "failed_retry_scheduled",
              stateLabel: "Failed — retry scheduled",
              active: true,
            },
          ],
          blocking: [
            {
              token: "USDT",
              state: "collecting",
              stateLabel: "Collecting / in progress",
              active: true,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        canExecuteNative: true,
        tokens: [
          {
            token: "USDT",
            state: "success",
            stateLabel: "Success",
            active: false,
          },
          {
            token: "USDC",
            state: "success",
            stateLabel: "Success",
            active: false,
          },
        ],
        blocking: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const polls: boolean[] = [];
    const result = await waitForNativeExecutionAllowed({
      apiBaseUrl: "http://localhost:3000",
      owner: "0xowner",
      network: "bsc",
      tokenCaptures: [mockCapture("USDT", true), mockCapture("USDC", true)],
      pollMs: 1,
      timeoutMs: 500,
      onPoll: (r) => polls.push(r.canExecuteNative),
    });
    assert.equal(result.canExecuteNative, true);
    assert.equal(nudgeCalls, 2);
    assert.equal(readinessCalls, 2);
    assert.deepEqual(polls, [false, true]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("waitForNativeExecutionAllowed throws when active collection never clears", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/nudge")) {
      return new Response(JSON.stringify({ ok: true, nudged: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        canExecuteNative: false,
        tokens: [
          {
            token: "USDC",
            state: "collecting",
            stateLabel: "Collecting / in progress",
            active: true,
          },
        ],
        blocking: [
          {
            token: "USDC",
            state: "collecting",
            stateLabel: "Collecting / in progress",
            active: true,
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        waitForNativeExecutionAllowed({
          apiBaseUrl: "http://localhost:3000",
          owner: "0xowner",
          network: "bsc",
          tokenCaptures: [mockCapture("USDC", true)],
          pollMs: 1,
          timeoutMs: 20,
        }),
      /Native blocked — active token collection: USDC \(Collecting \/ in progress\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
