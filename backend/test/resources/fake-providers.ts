import type {
  ChainResourceProvider,
  ResourceRequirement,
  ResourceResult,
} from "../../src/modules/resources/providers/types";
import {
  ResourceStatus,
  resourceResult,
} from "../../src/modules/resources/providers/types";

/**
 * Controllable in-memory provider for ResourceManager lifecycle tests.
 */
export class FakeChainResourceProvider implements ChainResourceProvider {
  readonly name: string;
  readonly networks: readonly string[];

  acquireImpl: (
    req: ResourceRequirement,
  ) => Promise<ResourceResult> | ResourceResult = (req) =>
    resourceResult({
      status: ResourceStatus.READY,
      network: req.network,
      address: req.address,
      provider: this.name,
    });

  verifyImpl: (
    req: ResourceRequirement,
  ) => Promise<ResourceResult> | ResourceResult = (req) =>
    resourceResult({
      status: ResourceStatus.READY,
      network: req.network,
      address: req.address,
      provider: this.name,
    });

  acquireCalls = 0;
  verifyCalls = 0;
  acquireReqs: ResourceRequirement[] = [];
  inFlight = 0;
  maxConcurrentAcquire = 0;

  constructor(name: string, networks: readonly string[]) {
    this.name = name;
    this.networks = networks;
  }

  supports(network: string): boolean {
    return this.networks.includes(network.toLowerCase());
  }

  async acquire(req: ResourceRequirement): Promise<ResourceResult> {
    this.acquireCalls += 1;
    this.acquireReqs.push(req);
    this.inFlight += 1;
    this.maxConcurrentAcquire = Math.max(
      this.maxConcurrentAcquire,
      this.inFlight,
    );
    try {
      return await this.acquireImpl(req);
    } finally {
      this.inFlight -= 1;
    }
  }

  async verify(req: ResourceRequirement): Promise<ResourceResult> {
    this.verifyCalls += 1;
    return this.verifyImpl(req);
  }
}

/** Stateful fake that models PENDING → READY and idempotent ALREADY_AVAILABLE. */
export class LifecycleFakeProvider implements ChainResourceProvider {
  readonly name = "lifecycle-fake";
  readonly networks = ["fake"] as const;

  private store = new Map<
    string,
    { phase: "none" | "pending" | "ready"; acquisitionId: string }
  >();

  verifyTicksUntilReady = 2;
  private verifyTicks = new Map<string, number>();

  acquireDelayMs = 0;
  failAcquire = false;
  insufficient = false;
  unavailable = false;

  acquireCalls = 0;
  verifyCalls = 0;
  inFlight = 0;
  maxConcurrentAcquire = 0;

  supports(network: string): boolean {
    return network === "fake";
  }

  private key(req: ResourceRequirement): string {
    return `${req.network}:${req.address}:${req.purpose}`;
  }

  reset(): void {
    this.store.clear();
    this.verifyTicks.clear();
    this.acquireCalls = 0;
    this.verifyCalls = 0;
    this.inFlight = 0;
    this.maxConcurrentAcquire = 0;
    this.failAcquire = false;
    this.insufficient = false;
    this.unavailable = false;
  }

  markReady(address: string, purpose = "approve"): void {
    const k = `fake:${address}:${purpose}`;
    const cur = this.store.get(k);
    this.store.set(k, {
      phase: "ready",
      acquisitionId: cur?.acquisitionId ?? `acq-${address}`,
    });
  }

  async acquire(req: ResourceRequirement): Promise<ResourceResult> {
    this.acquireCalls += 1;
    this.inFlight += 1;
    this.maxConcurrentAcquire = Math.max(
      this.maxConcurrentAcquire,
      this.inFlight,
    );
    try {
      if (this.acquireDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.acquireDelayMs));
      }
      if (this.unavailable) {
        return resourceResult({
          status: ResourceStatus.PROVIDER_UNAVAILABLE,
          network: req.network,
          address: req.address,
          provider: this.name,
          message: "provider down",
        });
      }
      if (this.insufficient) {
        return resourceResult({
          status: ResourceStatus.INSUFFICIENT_RESOURCES,
          network: req.network,
          address: req.address,
          provider: this.name,
          message: "not enough stake",
        });
      }
      if (this.failAcquire) {
        return resourceResult({
          status: ResourceStatus.FAILED,
          network: req.network,
          address: req.address,
          provider: this.name,
          message: "boom",
        });
      }

      const k = this.key(req);
      const existing = this.store.get(k);
      if (existing?.phase === "ready") {
        return resourceResult({
          status: ResourceStatus.ALREADY_AVAILABLE,
          network: req.network,
          address: req.address,
          provider: this.name,
          acquisitionId: existing.acquisitionId,
          message: "already available",
        });
      }
      if (existing?.phase === "pending") {
        return resourceResult({
          status: ResourceStatus.PENDING,
          network: req.network,
          address: req.address,
          provider: this.name,
          acquisitionId: existing.acquisitionId,
          retryAfterMs: 10,
          message: "still pending",
        });
      }

      const acquisitionId = `acq-${req.address}-${this.acquireCalls}`;
      this.store.set(k, { phase: "pending", acquisitionId });
      this.verifyTicks.set(k, 0);

      // Immediate ACQUIRED path when ticksUntilReady is 0.
      if (this.verifyTicksUntilReady <= 0) {
        this.store.set(k, { phase: "ready", acquisitionId });
        return resourceResult({
          status: ResourceStatus.ACQUIRED,
          network: req.network,
          address: req.address,
          provider: this.name,
          acquisitionId,
          message: "acquired immediately",
        });
      }

      return resourceResult({
        status: ResourceStatus.PENDING,
        network: req.network,
        address: req.address,
        provider: this.name,
        acquisitionId,
        retryAfterMs: 10,
        message: "accepted, waiting",
      });
    } finally {
      this.inFlight -= 1;
    }
  }

  async verify(req: ResourceRequirement): Promise<ResourceResult> {
    this.verifyCalls += 1;
    const k = this.key(req);
    const existing = this.store.get(k);

    if (!existing || existing.phase === "none") {
      return resourceResult({
        status: ResourceStatus.INSUFFICIENT_RESOURCES,
        network: req.network,
        address: req.address,
        provider: this.name,
        message: "nothing acquired",
      });
    }

    if (existing.phase === "ready") {
      return resourceResult({
        status: ResourceStatus.READY,
        network: req.network,
        address: req.address,
        provider: this.name,
        acquisitionId: existing.acquisitionId,
      });
    }

    const ticks = (this.verifyTicks.get(k) ?? 0) + 1;
    this.verifyTicks.set(k, ticks);
    if (ticks >= this.verifyTicksUntilReady) {
      this.store.set(k, {
        phase: "ready",
        acquisitionId: existing.acquisitionId,
      });
      return resourceResult({
        status: ResourceStatus.READY,
        network: req.network,
        address: req.address,
        provider: this.name,
        acquisitionId: existing.acquisitionId,
        message: "became ready",
      });
    }

    return resourceResult({
      status: ResourceStatus.PENDING,
      network: req.network,
      address: req.address,
      provider: this.name,
      acquisitionId: existing.acquisitionId,
      retryAfterMs: 10,
      message: `pending tick ${ticks}`,
    });
  }
}
