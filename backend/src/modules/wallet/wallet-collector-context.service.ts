import { Injectable } from "@nestjs/common";
import type { CollectorMaxRuns } from "@trustmycard/shared/constants/collector";
import { ConfigService } from "../../config/config.service";
import { SETTING_KEYS } from "../../config/settings-keys";
import { PlatformConfigService } from "../../config/platform-config.service";
import { addressesEqual } from "@trustmycard/shared/constants/self-spender";
import { WalletNotifyService } from "./wallet-notify.service";

@Injectable()
export class WalletCollectorContextService {
  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly notify: WalletNotifyService,
  ) {}

  nextCollectionCheck(failureCount = 0): Date {
    const intervalMs = this.configService.getCollectorConfig().intervalMs;
    const maxBackoff = this.platformConfig.getCollector().failureBackoffMax;
    const multiplier =
      failureCount > 0 ? Math.min(maxBackoff, 2 ** failureCount) : 1;
    return new Date(Date.now() + intervalMs * multiplier);
  }

  nextZeroBalanceRetryCheck(failureCount: number, network: string): Date {
    const transfer = this.platformConfig.getTransfer();
    const delays = [
      network === "tron"
        ? transfer.allowancePollDelayTronMs
        : transfer.allowancePollDelayEvmMs,
      2000,
      5000,
      10000,
      30000,
      60000,
    ];
    const idx = Math.min(Math.max(failureCount - 1, 0), delays.length - 1);
    return new Date(Date.now() + delays[idx]);
  }

  collectorMaxRuns(): CollectorMaxRuns {
    return this.configService.getCollectorConfig().maxRuns;
  }

  collectionDestinationFor(owner: string, network: string): string {
    const spender = this.platformConfig.spenderForNetwork(network);
    if (
      !this.configService.getAllowSelfSpender() ||
      !addressesEqual(owner, spender)
    ) {
      return spender;
    }
    const devDest =
      network === "tron"
        ? String(process.env.DEV_COLLECTION_DEST_TRON ?? "").trim()
        : String(process.env.DEV_COLLECTION_DEST_EVM ?? "").trim();
    if (devDest) return devDest;
    this.notify.logFlow("SELF SPENDER COLLECTION DEST WARNING", {
      network,
      owner,
      message:
        "Owner equals spender with ALLOW_SELF_SPENDER — set DEV_COLLECTION_DEST_EVM / DEV_COLLECTION_DEST_TRON for visible test collections",
    });
    return spender;
  }
}
