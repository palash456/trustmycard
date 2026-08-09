import assert from "node:assert/strict";
import test from "node:test";
import { EvmResourceProvider } from "../../src/modules/resources/providers/evm.resource-provider";
import { ResourceManager } from "../../src/modules/resources/resource-manager.service";
import { waitForResourcesReady } from "../../src/modules/resources/resource-lifecycle";
import { ResourceStatus } from "../../src/modules/resources/providers/types";
import { LifecycleFakeProvider } from "./fake-providers";

/**
 * Integration-style tests: real ResourceManager + real EvmResourceProvider
 * plus a stateful fake standing in for async chain sponsorship.
 */

test("integration: EvmResourceProvider is READY end-to-end via manager", async () => {
  const mgr = ResourceManager.create([new EvmResourceProvider()]);
  const address = "0x8bF415A644516Ef9e6eD8A0f8fEF8bC860009a4F";

  const acquired = await mgr.acquireResources({
    network: "eth",
    address,
    purpose: "approve",
  });
  assert.equal(acquired.status, ResourceStatus.READY);
  assert.equal(acquired.provider, "evm");

  const verified = await mgr.verifyResources({ network: "bsc", address });
  assert.equal(verified.status, ResourceStatus.READY);
});

test("integration: full lifecycle acquire PENDING → poll → READY → ALREADY_AVAILABLE", async () => {
  const chain = new LifecycleFakeProvider();
  chain.verifyTicksUntilReady = 2;
  const mgr = ResourceManager.create([chain, new EvmResourceProvider()]);

  const address = "wallet-lifecycle-1";
  const acquired = await mgr.acquireResources({
    network: "fake",
    address,
    purpose: "approve",
    amountRaw: "1000000",
  });
  assert.equal(acquired.status, ResourceStatus.PENDING);

  const ready = await waitForResourcesReady({
    retryAfterMs: acquired.retryAfterMs ?? 0,
    maxAttempts: 6,
    sleep: async () => undefined,
    verify: () =>
      mgr.verifyResources({ network: "fake", address, purpose: "approve" }),
  });
  assert.equal(ready.status, ResourceStatus.READY);

  const again = await mgr.acquireResources({
    network: "fake",
    address,
    purpose: "approve",
  });
  assert.equal(again.status, ResourceStatus.ALREADY_AVAILABLE);
  assert.equal(again.acquisitionId, acquired.acquisitionId);
});

test("integration: PENDING timeout surfaces FAILED without mutating READY peers", async () => {
  const slow = new LifecycleFakeProvider();
  slow.verifyTicksUntilReady = 50;
  const mgr = ResourceManager.create([slow, new EvmResourceProvider()]);

  const pending = await mgr.acquireResources({
    network: "fake",
    address: "slow-wallet",
  });
  assert.equal(pending.status, ResourceStatus.PENDING);

  const timedOut = await waitForResourcesReady({
    retryAfterMs: 0,
    maxAttempts: 2,
    sleep: async () => undefined,
    verify: () =>
      mgr.verifyResources({ network: "fake", address: "slow-wallet" }),
  });
  assert.equal(timedOut.status, ResourceStatus.FAILED);

  // Unrelated EVM path still healthy.
  const evm = await mgr.acquireResources({
    network: "eth",
    address: "0x8bF415A644516Ef9e6eD8A0f8fEF8bC860009a4F",
  });
  assert.equal(evm.status, ResourceStatus.READY);
});

test("integration: concurrent multi-wallet acquires stay isolated", async () => {
  const chain = new LifecycleFakeProvider();
  chain.verifyTicksUntilReady = 1;
  chain.acquireDelayMs = 15;
  const mgr = ResourceManager.create([chain]);

  const wallets = ["w1", "w2", "w3", "w4"];
  const results = await Promise.all(
    wallets.map((address) =>
      mgr.acquireResources({ network: "fake", address, purpose: "approve" }),
    ),
  );

  assert.ok(results.every((r) => r.status === ResourceStatus.PENDING));
  assert.equal(
    new Set(results.map((r) => r.acquisitionId)).size,
    wallets.length,
  );
  assert.ok(chain.maxConcurrentAcquire >= 2);

  const readies = await Promise.all(
    wallets.map((address) =>
      waitForResourcesReady({
        retryAfterMs: 0,
        maxAttempts: 4,
        sleep: async () => undefined,
        verify: () => mgr.verifyResources({ network: "fake", address }),
      }),
    ),
  );
  assert.ok(readies.every((r) => r.status === ResourceStatus.READY));
});

test("integration: verify without acquire yields INSUFFICIENT_RESOURCES", async () => {
  const mgr = ResourceManager.create([new LifecycleFakeProvider()]);
  const result = await mgr.verifyResources({
    network: "fake",
    address: "never-seen",
  });
  assert.equal(result.status, ResourceStatus.INSUFFICIENT_RESOURCES);
});
