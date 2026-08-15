import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";
import {
  loadPlatformConfig,
  type PlatformConfig,
} from "../../../../backend/src/config/platform-config.loader";

const REPO_ROOT = resolve(__dirname, "../../../..");

/** Parse platform.env files without mutating the live process.env. */
export function readPlatformEnvFiles(
  tmcEnv = process.env.TMC_ENV ?? "development",
): Record<string, string> {
  const merged: Record<string, string> = {};
  const files = [
    resolve(REPO_ROOT, "config/platform.env"),
    resolve(REPO_ROOT, "env/profiles", tmcEnv, "platform.env"),
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      merged[key] = value;
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
      walletPersonalSignEnabled: config.session.walletPersonalSignEnabled,
    },
  };
}

/** Load spenders and enabled networks from the real platform.env files. */
export function loadTestPlatformSnapshot(
  tmcEnv = process.env.TMC_ENV ?? "development",
): TestPlatformSnapshot {
  const envFiles = readPlatformEnvFiles(tmcEnv);
  const envSource: string[] = [];
  if (existsSync(resolve(REPO_ROOT, "config/platform.env"))) {
    envSource.push("config/platform.env");
  }
  const profilePath = resolve(
    REPO_ROOT,
    "env/profiles",
    tmcEnv,
    "platform.env",
  );
  if (existsSync(profilePath))
    envSource.push(`env/profiles/${tmcEnv}/platform.env`);

  const config = loadPlatformConfig(envFiles as NodeJS.ProcessEnv);
  const publicConfig = toPublicPlatformConfig(config);

  return {
    config,
    publicConfig,
    spenderEvm: config.wallets.spenderEvm,
    spenderTron: config.wallets.spenderTron,
    enabledNetworks: [...config.chains.enabledNetworks],
    envSource,
  };
}

export function assertPlatformSpendersConfigured(
  snapshot: TestPlatformSnapshot,
): void {
  if (
    !snapshot.spenderEvm &&
    snapshot.enabledNetworks.some((n) => n !== "tron")
  ) {
    throw new Error(
      "platform.env missing SPENDER_EVM / ADMIN_EVM_PRIVATE_KEY for EVM networks",
    );
  }
  if (!snapshot.spenderTron && snapshot.enabledNetworks.includes("tron")) {
    throw new Error(
      "platform.env missing SPENDER_TRON / ADMIN_TRON_PRIVATE_KEY for TRON",
    );
  }
}
