import assert from "node:assert/strict";
import test from "node:test";
import { ResourceManager } from "../../src/modules/resources/resource-manager.service";
import { waitForResourcesReady } from "../../src/modules/resources/resource-lifecycle";
import {
  ResourceStatus,
  resourceResult,
} from "../../src/modules/resources/providers/types";
import {
  FakeChainResourceProvider,
  LifecycleFakeProvider,
} from "./fake-providers";

const TRON_ADDR = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const EVM_ADDR = "0x8bF415A644516Ef9e6eD8A0f8fEF8bC860009a4F";

test("READY: EVM-like provider returns READY on acquire and verify", async () => {
  const evm = new FakeChainResourceProvider("evm", ["eth", "bsc", "evm"]);
  const mgr = ResourceManager.create([evm]);

  const acquired = await mgr.acquireResources({
    network: "eth",
    address: EVM_ADDR,
  });
  assert.equal(acquired.status, ResourceStatus.READY);

  const verified = await mgr.verifyResources({
    network: "eth",
    address: EVM_ADDR,
  });
  assert.equal(verified.status, ResourceStatus.READY);
});

test("ACQUIRED: provider can return immediately usable acquisition", async () => {
  const fake = new LifecycleFakeProvider();
  fake.verifyTicksUntilReady = 0;
  const mgr = ResourceManager.create([fake]);

  const acquired = await mgr.acquireResources({
    network: "fake",
    address: "user-1",
    purpose: "approve",
  });
  assert.equal(acquired.status, ResourceStatus.ACQUIRED);
  assert.ok(acquired.acquisitionId);

  const verified = await mgr.verifyResources({
    network: "fake",
    address: "user-1",
    purpose: "approve",
  });
  assert.equal(verified.status, ResourceStatus.READY);
});

test("ALREADY_AVAILABLE: second acquire is idempotent", async () => {
  const fake = new LifecycleFakeProvider();
  fake.verifyTicksUntilReady = 0;
  const mgr = ResourceManager.create([fake]);

  const first = await mgr.acquireResources({
    network: "fake",
    address: "user-2",
  });
  assert.equal(first.status, ResourceStatus.ACQUIRED);

  const second = await mgr.acquireResources({
    network: "fake",
    address: "user-2",
  });
  assert.equal(second.status, ResourceStatus.ALREADY_AVAILABLE);
  assert.equal(second.acquisitionId, first.acquisitionId);
  assert.equal(fake.acquireCalls, 2);
});

test("PENDING → READY: waitForResourcesReady polls until usable", async () => {
  const fake = new LifecycleFakeProvider();
  fake.verifyTicksUntilReady = 3;
  const mgr = ResourceManager.create([fake]);

  const acquired = await mgr.acquireResources({
    network: "fake",
    address: "user-pending",
  });
  assert.equal(acquired.status, ResourceStatus.PENDING);
  assert.equal(acquired.retryAfterMs, 10);

  const attempts: string[] = [];
  const ready = await waitForResourcesReady({
    retryAfterMs: 0,
    maxAttempts: 5,
    sleep: async () => undefined,
    verify: () =>
      mgr.verifyResources({ network: "fake", address: "user-pending" }),
    onAttempt: (_n, r) => attempts.push(r.status),
  });

  assert.equal(ready.status, ResourceStatus.READY);
  assert.ok(attempts.includes(ResourceStatus.PENDING));
  assert.equal(attempts[attempts.length - 1], ResourceStatus.READY);
  assert.ok(fake.verifyCalls >= 3);
});

test("PENDING timeout: exhausted polls become FAILED", async () => {
  const fake = new LifecycleFakeProvider();
  fake.verifyTicksUntilReady = 100; // never becomes ready in time
  const mgr = ResourceManager.create([fake]);

  const acquired = await mgr.acquireResources({
    network: "fake",
    address: "user-timeout",
  });
  assert.equal(acquired.status, ResourceStatus.PENDING);

  const timedOut = await waitForResourcesReady({
    retryAfterMs: 0,
    maxAttempts: 3,
    sleep: async () => undefined,
    verify: () =>
      mgr.verifyResources({ network: "fake", address: "user-timeout" }),
  });

  assert.equal(timedOut.status, ResourceStatus.FAILED);
  assert.match(timedOut.message ?? "", /timed out/i);
  assert.equal(fake.verifyCalls, 3);
});

test("PROVIDER_UNAVAILABLE: missing provider network", async () => {
  const mgr = ResourceManager.create([]);
  const result = await mgr.acquireResources({
    network: "solana",
    address: "SomeAddress111",
  });
  assert.equal(result.status, ResourceStatus.PROVIDER_UNAVAILABLE);
});

test("PROVIDER_UNAVAILABLE: provider reports itself unavailable", async () => {
  const fake = new LifecycleFakeProvider();
  fake.unavailable = true;
  const mgr = ResourceManager.create([fake]);

  const result = await mgr.acquireResources({
    network: "fake",
    address: "user-unavail",
  });
  assert.equal(result.status, ResourceStatus.PROVIDER_UNAVAILABLE);
});

test("FAILED: empty address and provider failure", async () => {
  const fake = new LifecycleFakeProvider();
  const mgr = ResourceManager.create([fake]);

  const missing = await mgr.acquireResources({ network: "fake", address: "" });
  assert.equal(missing.status, ResourceStatus.FAILED);

  fake.failAcquire = true;
  const boom = await mgr.acquireResources({
    network: "fake",
    address: "user-fail",
  });
  assert.equal(boom.status, ResourceStatus.FAILED);
});

test("INSUFFICIENT_RESOURCES: acquire and verify paths", async () => {
  const fake = new LifecycleFakeProvider();
  fake.insufficient = true;
  const mgr = ResourceManager.create([fake]);

  const acquired = await mgr.acquireResources({
    network: "fake",
    address: "user-poor",
  });
  assert.equal(acquired.status, ResourceStatus.INSUFFICIENT_RESOURCES);

  fake.insufficient = false;
  fake.reset();
  const verified = await mgr.verifyResources({
    network: "fake",
    address: "never-acquired",
  });
  assert.equal(verified.status, ResourceStatus.INSUFFICIENT_RESOURCES);
});

test("idempotency: concurrent acquires share PENDING identity", async () => {
  const fake = new LifecycleFakeProvider();
  fake.verifyTicksUntilReady = 5;
  fake.acquireDelayMs = 20;
  const mgr = ResourceManager.create([fake]);

  // Seed first pending acquisition.
  const first = await mgr.acquireResources({
    network: "fake",
    address: "user-conc",
  });
  assert.equal(first.status, ResourceStatus.PENDING);

  const [a, b, c] = await Promise.all([
    mgr.acquireResources({ network: "fake", address: "user-conc" }),
    mgr.acquireResources({ network: "fake", address: "user-conc" }),
    mgr.acquireResources({ network: "fake", address: "user-conc" }),
  ]);

  for (const r of [a, b, c]) {
    assert.equal(r.status, ResourceStatus.PENDING);
    assert.equal(r.acquisitionId, first.acquisitionId);
  }
  // 1 seed + 3 concurrent = 4 calls; all after first are idempotent PENDING.
  assert.equal(fake.acquireCalls, 4);
});

test("concurrent first-time acquires: provider sees overlapping in-flight work", async () => {
  const fake = new LifecycleFakeProvider();
  fake.verifyTicksUntilReady = 2;
  fake.acquireDelayMs = 30;
  const mgr = ResourceManager.create([fake]);

  const results = await Promise.all([
    mgr.acquireResources({ network: "fake", address: "user-a" }),
    mgr.acquireResources({ network: "fake", address: "user-b" }),
    mgr.acquireResources({ network: "fake", address: "user-c" }),
  ]);

  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.status === ResourceStatus.PENDING));
  assert.ok(fake.maxConcurrentAcquire >= 2);
  assert.equal(fake.acquireCalls, 3);
  // Distinct addresses → distinct acquisition ids
  const ids = new Set(results.map((r) => r.acquisitionId));
  assert.equal(ids.size, 3);
});

test("manager forwards prepare hints to provider", async () => {
  const fake = new FakeChainResourceProvider("hint", ["tron"]);
  let seenFee: unknown;
  fake.acquireImpl = (req) => {
    seenFee = req.hints?.feeLimit;
    return resourceResult({
      status: ResourceStatus.PENDING,
      network: req.network,
      address: req.address,
      provider: "hint",
      acquisitionId: "x",
      retryAfterMs: 1,
    });
  };
  const mgr = ResourceManager.create([fake]);

  await mgr.acquireResources({
    network: "tron",
    address: TRON_ADDR,
    feeLimit: 150_000_000,
    hints: { token: "USDT" },
  });

  assert.equal(seenFee, 150_000_000);
  assert.equal(fake.acquireReqs[0]?.hints?.token, "USDT");
});

test("address inference: T… → tron, 0x → evm when network omitted", async () => {
  const tron = new FakeChainResourceProvider("tron", ["tron"]);
  const evm = new FakeChainResourceProvider("evm", ["eth", "evm"]);
  tron.acquireImpl = (req) =>
    resourceResult({
      status: ResourceStatus.READY,
      network: req.network,
      address: req.address,
      provider: "tron",
    });
  evm.acquireImpl = (req) =>
    resourceResult({
      status: ResourceStatus.READY,
      network: req.network,
      address: req.address,
      provider: "evm",
    });

  const mgr = ResourceManager.create([tron, evm]);
  const t = await mgr.acquireResources({ address: TRON_ADDR });
  const e = await mgr.acquireResources({ address: EVM_ADDR });

  assert.equal(t.network, "tron");
  assert.equal(e.network, "evm");
  assert.equal(tron.acquireCalls, 1);
  assert.equal(evm.acquireCalls, 1);
});
