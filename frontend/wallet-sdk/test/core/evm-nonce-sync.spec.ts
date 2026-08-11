import assert from "node:assert/strict";
import test from "node:test";
import {
  readEvmPendingNonce,
  waitForEvmPendingNonceAdvance,
} from "../../src/core/evm-nonce-sync";

test("waitForEvmPendingNonceAdvance resolves when pending nonce increases", async () => {
  let nonce = 76n;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL) => {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: `0x${nonce.toString(16)}`,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  const waitPromise = waitForEvmPendingNonceAdvance({
    network: "pol",
    owner: "0x1111111111111111111111111111111111111111",
    baselineNonce: 76n,
    pollMs: 50,
    timeoutMs: 5_000,
  });

  setTimeout(() => {
    nonce = 77n;
  }, 120);

  const advanced = await waitPromise;
  assert.equal(advanced, 77n);

  globalThis.fetch = originalFetch;
});

test("readEvmPendingNonce returns null for non-EVM networks", async () => {
  const nonce = await readEvmPendingNonce({
    network: "tron",
    owner: "TV9FLGscQTRdknBfX4vvKAJYeFSw9VbWEF",
  });
  assert.equal(nonce, null);
});
