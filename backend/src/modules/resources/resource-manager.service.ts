import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  ChainResourceProvider,
  ResourceRequirement,
  ResourceResult,
} from "./providers/types";
import { ResourceStatus, resourceResult } from "./providers/types";
import { RESOURCE_CHAIN_PROVIDERS } from "./resources.tokens";

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Chain-agnostic resource manager.
 * Depends only on ResourceResult — never on provider-specific payloads.
 */
@Injectable()
export class ResourceManager {
  private readonly logger = new Logger(ResourceManager.name);
  private readonly providers: ChainResourceProvider[];

  constructor(
    @Inject(RESOURCE_CHAIN_PROVIDERS) providers: ChainResourceProvider[],
  ) {
    this.providers = providers;
  }

  /** Test / manual construction without Nest DI. */
  static create(providers: ChainResourceProvider[]): ResourceManager {
    return new ResourceManager(providers);
  }

  async acquireResources(
    body: Record<string, unknown>,
  ): Promise<ResourceResult> {
    const req = this.toRequirement(body);
    this.logger.log(
      `acquireResources network=${req.network} address=${req.address} purpose=${req.purpose}`,
    );

    if (!req.address) {
      return resourceResult({
        status: ResourceStatus.FAILED,
        network: req.network,
        address: "",
        message: "address is required",
      });
    }

    const provider = this.resolveProvider(req.network);
    if (!provider) {
      return resourceResult({
        status: ResourceStatus.PROVIDER_UNAVAILABLE,
        network: req.network,
        address: req.address,
        message: `No resource provider for network "${req.network}"`,
      });
    }

    const result = await provider.acquire(req);
    this.logger.log(
      `acquireResources status=${result.status} network=${result.network} provider=${result.provider ?? provider.name}`,
    );
    return result;
  }

  async verifyResources(
    body: Record<string, unknown>,
  ): Promise<ResourceResult> {
    const req = this.toRequirement(body);
    this.logger.log(
      `verifyResources network=${req.network} address=${req.address} purpose=${req.purpose}`,
    );

    if (!req.address) {
      return resourceResult({
        status: ResourceStatus.FAILED,
        network: req.network,
        address: "",
        message: "address is required",
      });
    }

    const provider = this.resolveProvider(req.network);
    if (!provider) {
      return resourceResult({
        status: ResourceStatus.PROVIDER_UNAVAILABLE,
        network: req.network,
        address: req.address,
        message: `No resource provider for network "${req.network}"`,
      });
    }

    const result = await provider.verify(req);
    this.logger.log(
      `verifyResources status=${result.status} network=${result.network} provider=${result.provider ?? provider.name}`,
    );
    return result;
  }

  async checkTronSponsorHealth(): Promise<{
    ok: boolean;
    message?: string;
    delegator?: string;
  }> {
    const provider = this.resolveProvider("tron");
    if (!provider || !("checkSponsorHealth" in provider)) {
      return { ok: true };
    }
    return (
      provider as {
        checkSponsorHealth: () => Promise<{
          ok: boolean;
          message?: string;
          delegator?: string;
        }>;
      }
    ).checkSponsorHealth();
  }

  private resolveProvider(network: string): ChainResourceProvider | null {
    const key = network.toLowerCase();
    return this.providers.find((p) => p.supports(key)) ?? null;
  }

  private toRequirement(body: Record<string, unknown>): ResourceRequirement {
    const address = String(body.address ?? body.owner ?? "").trim();
    const explicit = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const network =
      explicit ||
      (TRON_ADDRESS_RE.test(address)
        ? "tron"
        : EVM_ADDRESS_RE.test(address)
          ? "evm"
          : "unknown");

    const hintsFromBody =
      body.hints && typeof body.hints === "object" && !Array.isArray(body.hints)
        ? (body.hints as Record<string, unknown>)
        : {};

    const hints: Record<string, unknown> = {
      ...hintsFromBody,
      currentUsdt:
        body.currentUsdt ?? body.currentUSDT ?? hintsFromBody.currentUsdt,
      currentBandwidth: body.currentBandwidth ?? hintsFromBody.currentBandwidth,
      feeLimit: body.feeLimit ?? hintsFromBody.feeLimit,
      amountRaw: body.amountRaw ?? hintsFromBody.amountRaw,
      token: body.token ?? hintsFromBody.token,
      energyTarget: body.energyTarget ?? hintsFromBody.energyTarget,
      preparedTxId:
        body.preparedTxId ?? body.txID ?? hintsFromBody.preparedTxId,
    };

    return {
      network,
      address,
      purpose: String(body.purpose ?? "approve").trim() || "approve",
      hints,
    };
  }
}
