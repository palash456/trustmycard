import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";
import {
  loadPlatformConfig,
  type PlatformConfig,
} from "../../src/config/platform-config.loader";

const REPO_ROOT = resolve(__dirname, "../../..");

export function readPlatformEnvFiles(
  tmcEnv = process.env.TMC_ENV ?? "development",
): Record<string, string> {
  const merged: Record<string, string> = {};
  const files = [resolve(REPO_ROOT, "config/platform.env")];
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      merged[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
  return merged;
}

export type TestPlatformSnapshot = {
  config: PlatformConfig;
  publicConfig: PublicPlatformConfig;
  spenderEvm: string;
  spenderTron: string;
  enabledNetworks: string[];
  envSource: string[];
};

export function toPublicPlatformConfig(
  config: PlatformConfig,
): PublicPlatformConfig {
  return {
    wallets: {
      spenderEvm: config.wallets.spenderEvm,
      spenderTron: config.wallets.spenderTron,
    },
    approval: {
      approveAmountUsdtDefault: config.approval.approveAmountUsdtDefault,
      termsVersion: config.approval.termsVersion,
      allowSelfSpender: config.approval.allowSelfSpender,
      tronApproveFeeLimitSun: config.approval.tronApproveFeeLimitSun,
      verifyIntervalMs: config.approval.verifyIntervalMs,
      verifyMaxAttempts: config.approval.verifyMaxAttempts,
      postConfirmDelayEvmMs: config.approval.postConfirmDelayEvmMs,
      postConfirmDelayTronMs: config.approval.postConfirmDelayTronMs,
    },
    collection: {
      defaultMode: config.collection.defaultMode,
      networkCaps: {},
    },
    native: {
      transferLockTtlMs: config.native.transferLockTtlMs,
      confirmRetryDelaysMs: [...config.native.confirmRetryDelaysMs],
      registerRetryDelaysMs: [...config.native.registerRetryDelaysMs],
      estimateMaxUnderflowBps: config.native.estimateMaxUnderflowBps,
      txVisibilityMaxAttempts: config.native.txVisibilityMaxAttempts,
      txVisibilityBaseDelayMs: config.native.txVisibilityBaseDelayMs,
    },
    client: { ...config.client },
    transfer: {
      evmTxConfirmTimeoutMs: config.transfer.evmTxConfirmTimeoutMs,
      allowancePollDelayEvmMs: config.transfer.allowancePollDelayEvmMs,
      allowancePollDelayTronMs: config.transfer.allowancePollDelayTronMs,
      confirmationRetryDelayMs: config.transfer.confirmationRetryDelayMs,
      tronTxConfirmMaxAttempts: config.transfer.tronTxConfirmMaxAttempts,
      tronTxConfirmPollMs: config.transfer.tronTxConfirmPollMs,
      evmGasLimitBufferNumerator: config.transfer.evmGasLimitBufferNumerator,
      evmGasLimitBufferDenominator:
        config.transfer.evmGasLimitBufferDenominator,
    },
    chains: {
      tronFullHost: config.chains.tronFullHost,
      enabledNetworks: [...config.chains.enabledNetworks],
    },
    featureFlags: {
      collectorEnabled: config.collector.enabled,
      collectorMaxRuns: config.collector.maxRuns,
      nativeReconcileEnabled: config.native.reconcileEnabled,
      resourceSponsorEnabled: config.resources.sponsorEnabled,
    },
  };
}

export function loadTestPlatformSnapshot(
  tmcEnv = process.env.TMC_ENV ?? "development",
): TestPlatformSnapshot {
  const envSource: string[] = [];
  if (existsSync(resolve(REPO_ROOT, "config/platform.env"))) {
    envSource.push("config/platform.env");
  }

  const config = loadPlatformConfig(
    readPlatformEnvFiles(tmcEnv) as NodeJS.ProcessEnv,
  );
  return {
    config,
    publicConfig: toPublicPlatformConfig(config),
    spenderEvm: config.wallets.spenderEvm,
    spenderTron: config.wallets.spenderTron,
    enabledNetworks: [...config.chains.enabledNetworks],
    envSource,
  };
}

export function spenderForNetwork(
  platform: TestPlatformSnapshot,
  network: string,
): string {
  return network === "tron" ? platform.spenderTron : platform.spenderEvm;
}

export function assertPlatformSpendersConfigured(
  platform: TestPlatformSnapshot,
): void {
  if (
    !platform.spenderEvm &&
    platform.enabledNetworks.some((n) => n !== "tron")
  ) {
    throw new Error(
      "platform.env missing EVM spender for enabled EVM networks",
    );
  }
  if (!platform.spenderTron && platform.enabledNetworks.includes("tron")) {
    throw new Error("platform.env missing TRON spender");
  }
}
