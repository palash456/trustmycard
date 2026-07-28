import { Injectable, Logger } from "@nestjs/common";
import type {
  ChainResourceProvider,
  ResourceRequirement,
  ResourceResult,
} from "./types";
import { ResourceStatus, resourceResult } from "./types";

const EVM_NETWORKS = ["eth", "bsc", "pol", "avax", "arb", "base", "evm"] as const;

/**
 * EVM resource provider.
 * Phase 1: no fee sponsorship (user pays gas). Hook point for future paymasters.
 */
@Injectable()
export class EvmResourceProvider implements ChainResourceProvider {
  readonly name = "evm";
  readonly networks = EVM_NETWORKS;
  private readonly logger = new Logger(EvmResourceProvider.name);

  supports(network: string): boolean {
    return (EVM_NETWORKS as readonly string[]).includes(network.toLowerCase());
  }

  async acquire(req: ResourceRequirement): Promise<ResourceResult> {
    this.logger.log(
      `EVM acquire → READY network=${req.network} address=${req.address}`
    );
    return resourceResult({
      status: ResourceStatus.READY,
      network: req.network,
      address: req.address,
      provider: this.name,
      message: "EVM networks do not require resource sponsorship",
      detail: { reason: "not_required_for_network" },
    });
  }

  async verify(req: ResourceRequirement): Promise<ResourceResult> {
    return resourceResult({
      status: ResourceStatus.READY,
      network: req.network,
      address: req.address,
      provider: this.name,
      message: "EVM networks do not require resource sponsorship",
      detail: { reason: "not_required_for_network" },
    });
  }
}
