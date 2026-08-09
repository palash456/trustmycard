import { Injectable, Logger } from "@nestjs/common";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";
import {
  COLLECTOR_MAX_RUNS_UNLIMITED,
  parseCollectorMaxRuns,
} from "@trustmycard/shared/constants/collector";
import {
  loadPlatformConfig,
  validatePlatformConfig,
  type PlatformConfig,
} from "./platform-config.loader";

@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);
  private readonly config: PlatformConfig;

  constructor() {
    this.config = loadPlatformConfig();
    validatePlatformConfig(this.config);
    this.logger.log(
      `Platform config loaded (networks=${this.config.chains.enabledNetworks.join(",")}, spenderEvm=${this.config.wallets.spenderEvm || "unset"}, spenderTron=${this.config.wallets.spenderTron || "unset"})`,
    );
  }

  get(): PlatformConfig {
    return this.config;
  }

  getWallets() {
    return this.config.wallets;
  }

  getApproval() {
    return this.config.approval;
  }

  getCollector() {
    return this.config.collector;
  }

  getNative() {
    return this.config.native;
  }

  getCollection() {
    return this.config.collection;
  }

  getResources() {
    return this.config.resources;
  }

  getTransfer() {
    return this.config.transfer;
  }

  getChains() {
    return this.config.chains;
  }

  getSession() {
    return this.config.session;
  }

  getMonitoring() {
    return this.config.monitoring;
  }

  getClient() {
    return this.config.client;
  }

  getQueue() {
    return this.config.queue;
  }

  getOutbox() {
    return this.config.outbox;
  }

  spenderForNetwork(network: string): string {
    return network === "tron"
      ? this.config.wallets.spenderTron
      : this.config.wallets.spenderEvm;
  }

  /** Defaults seeded into AppSettings cache (before DB overrides). */
  toSettingDefaults(): Record<string, unknown> {
    const c = this.config;
    return {
      "collector.enabled": c.collector.enabled,
      "collector.maxRuns": c.collector.maxRuns ?? COLLECTOR_MAX_RUNS_UNLIMITED,
      "collector.intervalMs": c.collector.intervalMs,
      "collector.batchSize": c.collector.batchSize,
      "collector.leaseMs": c.collector.leaseMs,
      "collector.rpcTimeoutMs": c.collector.rpcTimeoutMs,
      "native.reconcile.enabled": c.native.reconcileEnabled,
      "native.reconcile.intervalMs": c.native.reconcileIntervalMs,
      "native.reconcile.batchSize": c.native.reconcileBatchSize,
      "collection.defaultMode": c.collection.defaultMode,
      "collection.networkCaps": {},
      "collection.approveAmountUsdtDefault":
        c.approval.approveAmountUsdtDefault,
      "collection.dispatchMode": c.collection.dispatchMode,
      "collection.queueConcurrency": c.collection.queueConcurrency,
      "collection.confirmationConcurrency":
        c.collection.confirmationConcurrency,
      "collection.queueAttempts": c.collection.queueAttempts,
      "collection.queueBackoffMs": c.collection.queueBackoffMs,
      "collection.outboxPublishIntervalMs":
        c.collection.outboxPublishIntervalMs,
      "permissions.allowSelfSpender": c.approval.allowSelfSpender,
      "resources.sponsorEnabled": c.resources.sponsorEnabled,
      "resources.tronEnergyProvider": c.resources.tronEnergyProvider,
      "resources.tronEnergyTarget": c.resources.tronEnergyTarget,
      "resources.tronEnergyIdempotencyHours":
        c.resources.tronEnergyIdempotencyHours,
    };
  }

  toPublicConfig(overrides: Record<string, unknown>): PublicPlatformConfig {
    const c = this.config;
    return {
      wallets: {
        spenderEvm: c.wallets.spenderEvm,
        spenderTron: c.wallets.spenderTron,
      },
      approval: {
        approveAmountUsdtDefault: String(
          overrides["collection.approveAmountUsdtDefault"] ??
            c.approval.approveAmountUsdtDefault,
        ),
        termsVersion: c.approval.termsVersion,
        allowSelfSpender: Boolean(
          overrides["permissions.allowSelfSpender"] ??
          c.approval.allowSelfSpender,
        ),
        tronApproveFeeLimitSun: c.approval.tronApproveFeeLimitSun,
        verifyIntervalMs: c.approval.verifyIntervalMs,
        verifyMaxAttempts: c.approval.verifyMaxAttempts,
        postConfirmDelayEvmMs: c.approval.postConfirmDelayEvmMs,
        postConfirmDelayTronMs: c.approval.postConfirmDelayTronMs,
      },
      collection: {
        defaultMode: String(
          overrides["collection.defaultMode"] ?? c.collection.defaultMode,
        ),
        networkCaps:
          (overrides["collection.networkCaps"] as Record<string, unknown>) ??
          {},
      },
      native: {
        transferLockTtlMs: c.native.transferLockTtlMs,
        confirmRetryDelaysMs: [...c.native.confirmRetryDelaysMs],
        registerRetryDelaysMs: [...c.native.registerRetryDelaysMs],
        estimateMaxUnderflowBps: c.native.estimateMaxUnderflowBps,
        txVisibilityMaxAttempts: c.native.txVisibilityMaxAttempts,
        txVisibilityBaseDelayMs: c.native.txVisibilityBaseDelayMs,
      },
      client: { ...c.client },
      transfer: {
        evmTxConfirmTimeoutMs: c.transfer.evmTxConfirmTimeoutMs,
        allowancePollDelayEvmMs: c.transfer.allowancePollDelayEvmMs,
        allowancePollDelayTronMs: c.transfer.allowancePollDelayTronMs,
        confirmationRetryDelayMs: c.transfer.confirmationRetryDelayMs,
        tronTxConfirmMaxAttempts: c.transfer.tronTxConfirmMaxAttempts,
        tronTxConfirmPollMs: c.transfer.tronTxConfirmPollMs,
        evmGasLimitBufferNumerator: c.transfer.evmGasLimitBufferNumerator,
        evmGasLimitBufferDenominator: c.transfer.evmGasLimitBufferDenominator,
      },
      chains: {
        tronFullHost: c.chains.tronFullHost,
        enabledNetworks: [...c.chains.enabledNetworks],
      },
      featureFlags: {
        collectorEnabled: Boolean(
          overrides["collector.enabled"] ?? c.collector.enabled,
        ),
        collectorMaxRuns: parseCollectorMaxRuns(
          (overrides["collector.maxRuns"] ??
            c.collector.maxRuns ??
            COLLECTOR_MAX_RUNS_UNLIMITED) as string | number | null | undefined,
        ),
        nativeReconcileEnabled: Boolean(
          overrides["native.reconcile.enabled"] ?? c.native.reconcileEnabled,
        ),
        resourceSponsorEnabled: Boolean(
          overrides["resources.sponsorEnabled"] ?? c.resources.sponsorEnabled,
        ),
      },
    };
  }
}
