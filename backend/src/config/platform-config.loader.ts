import { Wallet } from "ethers";
import { TronWeb } from "tronweb";
import {
  assertValidCollectorMaxRunsInput,
  type CollectorMaxRuns,
} from "@trustmycard/shared/constants/collector";

export type PlatformWalletsConfig = {
  adminEvmPrivateKey: string;
  adminTronPrivateKey: string;
  tronEnergyDelegatorPrivateKey: string;
  spenderEvm: string;
  spenderTron: string;
};

export type PlatformApprovalConfig = {
  approveAmountUsdtDefault: string;
  termsVersion: string;
  allowSelfSpender: boolean;
  tronApproveFeeLimitSun: number;
  tronTransferFeeLimitSun: number;
  verifyIntervalMs: number;
  verifyMaxAttempts: number;
  postConfirmDelayEvmMs: number;
  postConfirmDelayTronMs: number;
};

export type PlatformCollectorConfig = {
  enabled: boolean;
  maxRuns: CollectorMaxRuns;
  intervalMs: number;
  batchSize: number;
  leaseMs: number;
  rpcTimeoutMs: number;
  submittedGraceMs: number;
  failureBackoffMax: number;
};

export type PlatformNativeConfig = {
  reconcileEnabled: boolean;
  reconcileIntervalMs: number;
  reconcileBatchSize: number;
  pendingMaxReconcileAttempts: number;
  amountMaxUnderflowBps: bigint;
  transferLockTtlMs: number;
  confirmRetryDelaysMs: number[];
  registerRetryDelaysMs: number[];
  estimateMaxUnderflowBps: number;
  txVisibilityMaxAttempts: number;
  txVisibilityBaseDelayMs: number;
};

export type PlatformCollectionConfig = {
  defaultMode: string;
  dispatchMode: string;
  queueConcurrency: number;
  confirmationConcurrency: number;
  queueAttempts: number;
  queueBackoffMs: number;
  outboxPublishIntervalMs: number;
  recoveryIntervalMs: number;
  recoveryBatchSize: number;
  outboxClaimBatchSize: number;
  workersEnabled: boolean;
  merchantWebhookConcurrency: number;
};

export type PlatformResourcesConfig = {
  sponsorEnabled: boolean;
  tronEnergyProvider: string;
  tronEnergyTarget: number;
  tronEnergyIdempotencyHours: number;
  tronEnergyPendingRetryMs: number;
  tronEnergyDelegateSun: number;
  tronEnergyHttpUrl: string;
  tronEnergyHttpApiKey: string;
  tronEnergyHttpAddressField: string;
  tronEnergyHttpPeriod: string;
  tronEnergyHttpTimeoutMs: number;
};

export type PlatformTransferConfig = {
  evmTxConfirmTimeoutMs: number;
  allowancePollDelayEvmMs: number;
  allowancePollDelayTronMs: number;
  allowanceVerifyMaxAttempts: number;
  confirmationRetryDelayMs: number;
  tronTxConfirmMaxAttempts: number;
  tronTxConfirmPollMs: number;
  evmGasLimitBufferNumerator: number;
  evmGasLimitBufferDenominator: number;
  evmGasEstimateFallback: number;
  evmMinPriorityFeeWei: bigint;
};

export type PlatformClientConfig = {
  confirmationPollMs: number;
  confirmationMaxAttempts: number;
  confirmationConfirmations: number;
  resourcePollMinDelayMs: number;
  resourcePollMaxDelayMs: number;
};

export type PlatformQueueConfig = {
  completeRetentionSec: number;
  completeMaxCount: number;
  dlqListLimit: number;
};

export type PlatformOutboxConfig = {
  claimLockMs: number;
};

export type PlatformChainsConfig = {
  tronFullHost: string;
  trongridApiKey: string;
  enabledNetworks: string[];
};

export type PlatformSessionConfig = {
  walletSessionTtlMs: number;
};

export type PlatformMonitoringConfig = {
  merchantWebhookUrl: string;
  merchantWebhookSecret: string;
  merchantWebhookTimeoutMs: number;
};

export type PlatformConfig = {
  wallets: PlatformWalletsConfig;
  approval: PlatformApprovalConfig;
  collector: PlatformCollectorConfig;
  native: PlatformNativeConfig;
  collection: PlatformCollectionConfig;
  resources: PlatformResourcesConfig;
  transfer: PlatformTransferConfig;
  client: PlatformClientConfig;
  queue: PlatformQueueConfig;
  outbox: PlatformOutboxConfig;
  chains: PlatformChainsConfig;
  session: PlatformSessionConfig;
  monitoring: PlatformMonitoringConfig;
};

function envStr(env: NodeJS.ProcessEnv, key: string, fallback = ""): string {
  return (env[key] ?? fallback).trim();
}

function envBool(env: NodeJS.ProcessEnv, key: string, fallback = false): boolean {
  const raw = envStr(env, key);
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

function envInt(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY
): number {
  const n = Number(envStr(env, key) || String(fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function deriveEvmAddress(privateKey: string): string {
  if (!privateKey) return "";
  return new Wallet(privateKey).address;
}

function deriveTronAddress(privateKey: string): string {
  if (!privateKey) return "";
  const tron = new TronWeb({
    fullHost: envStr(process.env, "TRON_FULL_HOST", "https://api.trongrid.io"),
    privateKey,
  });
  const address = tron.address.fromPrivateKey(privateKey);
  return typeof address === "string" ? address : "";
}

function envIntList(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number[]
): number[] {
  const raw = envStr(env, key);
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parsed.length > 0 ? parsed : fallback;
}

function resolveSpenderEvm(env: NodeJS.ProcessEnv, derived: string): string {
  const explicit =
    envStr(env, "SPENDER_EVM") ||
    envStr(env, "NEXT_PUBLIC_SPENDER_EVM");
  if (explicit && derived && explicit.toLowerCase() !== derived.toLowerCase()) {
    throw new Error(
      "SPENDER_EVM must match address derived from ADMIN_EVM_PRIVATE_KEY"
    );
  }
  return explicit || derived;
}

function resolveSpenderTron(env: NodeJS.ProcessEnv, derived: string): string {
  const explicit =
    envStr(env, "SPENDER_TRON") ||
    envStr(env, "NEXT_PUBLIC_SPENDER_TRON");
  if (explicit && derived && explicit !== derived) {
    throw new Error(
      "SPENDER_TRON must match address derived from ADMIN_TRON_PRIVATE_KEY"
    );
  }
  return explicit || derived;
}

/** Sole module allowed to read platform-wide keys from process.env (after env.ts bootstrap). */
export function loadPlatformConfig(
  env: NodeJS.ProcessEnv = process.env
): PlatformConfig {
  const adminEvmPrivateKey = envStr(env, "ADMIN_EVM_PRIVATE_KEY");
  const adminTronPrivateKey = envStr(env, "ADMIN_TRON_PRIVATE_KEY");
  const tronEnergyDelegatorPrivateKey =
    envStr(env, "TRON_ENERGY_DELEGATOR_PRIVATE_KEY") || adminTronPrivateKey;

  const spenderEvm = resolveSpenderEvm(env, deriveEvmAddress(adminEvmPrivateKey));
  const spenderTron = resolveSpenderTron(env, deriveTronAddress(adminTronPrivateKey));

  const collectorIntervalMs = envInt(env, "COLLECTOR_INTERVAL_MS", 120_000, 30_000);

  const approveDefault =
    envStr(env, "APPROVE_AMOUNT_USDT_DEFAULT") ||
    envStr(env, "NEXT_PUBLIC_APPROVE_AMOUNT_USDT", "0") ||
    "0";

  const enabledRaw =
    envStr(env, "PLATFORM_ENABLED_NETWORKS") ||
    "eth,bsc,pol,avax,arb,base,tron";

  return {
    wallets: {
      adminEvmPrivateKey,
      adminTronPrivateKey,
      tronEnergyDelegatorPrivateKey,
      spenderEvm,
      spenderTron,
    },
    approval: {
      approveAmountUsdtDefault: approveDefault,
      termsVersion: envStr(env, "TERMS_VERSION", "2026-07-28"),
      allowSelfSpender: envBool(env, "ALLOW_SELF_SPENDER", false),
      tronApproveFeeLimitSun: envInt(env, "TRON_APPROVE_FEE_LIMIT_SUN", 150_000_000, 1),
      tronTransferFeeLimitSun: envInt(env, "TRON_TRANSFER_FEE_LIMIT_SUN", 300_000_000, 1),
      verifyIntervalMs: envInt(env, "APPROVAL_VERIFY_INTERVAL_MS", 1_500, 100),
      verifyMaxAttempts: envInt(env, "APPROVAL_VERIFY_MAX_ATTEMPTS", 3, 1),
      postConfirmDelayEvmMs: envInt(env, "APPROVAL_POST_CONFIRM_DELAY_EVM_MS", 600, 0),
      postConfirmDelayTronMs: envInt(env, "APPROVAL_POST_CONFIRM_DELAY_TRON_MS", 1_200, 0),
    },
    collector: {
      enabled: envBool(env, "COLLECTOR_ENABLED", true),
      maxRuns: assertValidCollectorMaxRunsInput(
        envStr(env, "COLLECTOR_MAX_RUNS") || null,
        "COLLECTOR_MAX_RUNS"
      ),
      intervalMs: collectorIntervalMs,
      batchSize: envInt(env, "COLLECTOR_BATCH_SIZE", 20, 1, 100),
      leaseMs: envInt(env, "COLLECTOR_LEASE_MS", Math.max(collectorIntervalMs * 2, 900_000), 30_000),
      rpcTimeoutMs: envInt(env, "COLLECTOR_RPC_TIMEOUT_MS", 15_000, 3_000),
      submittedGraceMs: envInt(env, "COLLECTION_SUBMITTED_GRACE_MS", 30 * 60_000, 60_000),
      failureBackoffMax: envInt(env, "COLLECTION_FAILURE_BACKOFF_MAX", 8, 1, 32),
    },
    native: {
      reconcileEnabled: envBool(env, "NATIVE_RECONCILE_ENABLED", true),
      reconcileIntervalMs: envInt(env, "NATIVE_RECONCILE_INTERVAL_MS", 60_000, 15_000),
      reconcileBatchSize: envInt(env, "NATIVE_RECONCILE_BATCH_SIZE", 10, 1, 50),
      pendingMaxReconcileAttempts: envInt(env, "NATIVE_PENDING_MAX_RECONCILE_ATTEMPTS", 120, 10),
      amountMaxUnderflowBps: BigInt(
        envInt(env, "NATIVE_AMOUNT_MAX_UNDERFLOW_BPS", 1, 0)
      ),
      transferLockTtlMs: envInt(env, "NATIVE_TRANSFER_LOCK_TTL_MS", 120_000, 10_000),
      confirmRetryDelaysMs: envIntList(
        env,
        "NATIVE_CONFIRM_RETRY_DELAYS_MS",
        [2_000, 5_000, 10_000, 20_000, 30_000]
      ),
      registerRetryDelaysMs: envIntList(
        env,
        "NATIVE_REGISTER_RETRY_DELAYS_MS",
        [1_000, 2_000, 5_000, 10_000, 15_000, 20_000]
      ),
      estimateMaxUnderflowBps: envInt(env, "NATIVE_ESTIMATE_MAX_UNDERFLOW_BPS", 200, 0),
      txVisibilityMaxAttempts: envInt(env, "NATIVE_TX_VISIBILITY_MAX_ATTEMPTS", 4, 1),
      txVisibilityBaseDelayMs: envInt(env, "NATIVE_TX_VISIBILITY_BASE_DELAY_MS", 750, 100),
    },
    collection: {
      defaultMode: envStr(env, "COLLECTION_DEFAULT_MODE", "maximum"),
      dispatchMode: envStr(env, "COLLECTION_DISPATCH_MODE", "poll").toLowerCase(),
      queueConcurrency: envInt(env, "COLLECTION_QUEUE_CONCURRENCY", 4, 1),
      confirmationConcurrency: envInt(env, "COLLECTION_CONFIRMATION_CONCURRENCY", 16, 1),
      queueAttempts: envInt(env, "COLLECTION_QUEUE_ATTEMPTS", 8, 1),
      queueBackoffMs: envInt(env, "COLLECTION_QUEUE_BACKOFF_MS", 5_000, 1_000),
      outboxPublishIntervalMs: envInt(env, "OUTBOX_PUBLISH_INTERVAL_MS", 1_000, 250),
      recoveryIntervalMs: envInt(env, "COLLECTION_RECOVERY_INTERVAL_MS", 30_000, 5_000),
      recoveryBatchSize: envInt(env, "COLLECTION_RECOVERY_BATCH_SIZE", 100, 1),
      outboxClaimBatchSize: envInt(env, "OUTBOX_CLAIM_BATCH_SIZE", 100, 1),
      workersEnabled: envBool(env, "COLLECTION_WORKERS_ENABLED", false),
      merchantWebhookConcurrency: envInt(env, "MERCHANT_WEBHOOK_CONCURRENCY", 8, 1),
    },
    resources: {
      sponsorEnabled: envBool(env, "RESOURCE_SPONSOR_ENABLED", true),
      tronEnergyProvider: envStr(env, "TRON_ENERGY_PROVIDER", "self") || "self",
      tronEnergyTarget: envInt(env, "TRON_ENERGY_TARGET", 65_000, 1),
      tronEnergyIdempotencyHours: envInt(env, "TRON_ENERGY_IDEMPOTENCY_HOURS", 6, 1),
      tronEnergyPendingRetryMs: envInt(env, "TRON_ENERGY_PENDING_RETRY_MS", 2_000, 100),
      tronEnergyDelegateSun: envInt(env, "TRON_ENERGY_DELEGATE_SUN", 0, 0),
      tronEnergyHttpUrl: envStr(env, "TRON_ENERGY_HTTP_URL"),
      tronEnergyHttpApiKey: envStr(env, "TRON_ENERGY_HTTP_API_KEY"),
      tronEnergyHttpAddressField: envStr(env, "TRON_ENERGY_HTTP_ADDRESS_FIELD", "destinationAddress"),
      tronEnergyHttpPeriod: envStr(env, "TRON_ENERGY_HTTP_PERIOD", "1h"),
      tronEnergyHttpTimeoutMs: envInt(env, "TRON_ENERGY_HTTP_TIMEOUT_MS", 30_000, 5_000),
    },
    transfer: {
      evmTxConfirmTimeoutMs: envInt(env, "EVM_TX_CONFIRM_TIMEOUT_MS", 60_000, 5_000),
      allowancePollDelayEvmMs: envInt(env, "ALLOWANCE_POLL_DELAY_EVM_MS", 900, 0),
      allowancePollDelayTronMs: envInt(env, "ALLOWANCE_POLL_DELAY_TRON_MS", 1_500, 0),
      allowanceVerifyMaxAttempts: envInt(env, "APPROVAL_VERIFY_MAX_ATTEMPTS", 3, 1),
      confirmationRetryDelayMs: envInt(env, "TRANSFER_CONFIRMATION_RETRY_DELAY_MS", 2_000, 0),
      tronTxConfirmMaxAttempts: envInt(env, "TRON_TX_CONFIRM_MAX_ATTEMPTS", 30, 1),
      tronTxConfirmPollMs: envInt(env, "TRON_TX_CONFIRM_POLL_MS", 2_000, 100),
      evmGasLimitBufferNumerator: envInt(env, "EVM_GAS_LIMIT_BUFFER_NUMERATOR", 120, 100),
      evmGasLimitBufferDenominator: envInt(env, "EVM_GAS_LIMIT_BUFFER_DENOMINATOR", 100, 1),
      evmGasEstimateFallback: envInt(env, "EVM_GAS_ESTIMATE_FALLBACK", 21_000, 21_000),
      evmMinPriorityFeeWei: BigInt(
        envStr(env, "EVM_MIN_PRIORITY_FEE_WEI", "1000000000") || "1000000000"
      ),
    },
    client: {
      confirmationPollMs: envInt(env, "CLIENT_CONFIRMATION_POLL_MS", 2_000, 100),
      confirmationMaxAttempts: envInt(env, "CLIENT_CONFIRMATION_MAX_ATTEMPTS", 30, 1),
      confirmationConfirmations: envInt(env, "CLIENT_CONFIRMATION_CONFIRMATIONS", 1, 1),
      resourcePollMinDelayMs: envInt(env, "CLIENT_RESOURCE_POLL_MIN_DELAY_MS", 500, 50),
      resourcePollMaxDelayMs: envInt(env, "CLIENT_RESOURCE_POLL_MAX_DELAY_MS", 8_000, 500),
    },
    queue: {
      completeRetentionSec: envInt(env, "COLLECTION_QUEUE_COMPLETE_RETENTION_SEC", 86_400, 60),
      completeMaxCount: envInt(env, "COLLECTION_QUEUE_COMPLETE_MAX_COUNT", 10_000, 100),
      dlqListLimit: envInt(env, "COLLECTION_DLQ_LIST_LIMIT", 200, 10),
    },
    outbox: {
      claimLockMs: envInt(env, "OUTBOX_CLAIM_LOCK_MS", 60_000, 5_000),
    },
    chains: {
      tronFullHost: envStr(env, "TRON_FULL_HOST", "https://api.trongrid.io"),
      trongridApiKey: envStr(env, "TRONGRID_API_KEY"),
      enabledNetworks: enabledRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    },
    session: {
      walletSessionTtlMs: envInt(env, "WALLET_SESSION_TTL_MS", 30 * 60_000, 60_000),
    },
    monitoring: {
      merchantWebhookUrl: envStr(env, "MERCHANT_WEBHOOK_URL"),
      merchantWebhookSecret: envStr(env, "MERCHANT_WEBHOOK_SECRET"),
      merchantWebhookTimeoutMs: envInt(env, "MERCHANT_WEBHOOK_TIMEOUT_MS", 10_000, 1_000),
    },
  };
}

export function validatePlatformConfig(config: PlatformConfig): void {
  const errors: string[] = [];

  if (config.collector.enabled) {
    if (!config.wallets.adminEvmPrivateKey && config.chains.enabledNetworks.some((n) => n !== "tron")) {
      errors.push("COLLECTOR_ENABLED requires ADMIN_EVM_PRIVATE_KEY for EVM networks");
    }
    if (!config.wallets.adminTronPrivateKey && config.chains.enabledNetworks.includes("tron")) {
      errors.push("COLLECTOR_ENABLED requires ADMIN_TRON_PRIVATE_KEY for TRON");
    }
  }

  if (
    config.wallets.adminEvmPrivateKey &&
    config.wallets.spenderEvm &&
    deriveEvmAddress(config.wallets.adminEvmPrivateKey).toLowerCase() !==
      config.wallets.spenderEvm.toLowerCase()
  ) {
    errors.push("ADMIN_EVM_PRIVATE_KEY does not derive configured spender EVM address");
  }

  if (
    config.wallets.adminTronPrivateKey &&
    config.wallets.spenderTron &&
    deriveTronAddress(config.wallets.adminTronPrivateKey) !== config.wallets.spenderTron
  ) {
    errors.push("ADMIN_TRON_PRIVATE_KEY does not derive configured spender TRON address");
  }

  if (!["poll", "shadow", "queue"].includes(config.collection.dispatchMode)) {
    errors.push("COLLECTION_DISPATCH_MODE must be poll, shadow, or queue");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid platform configuration:\n- ${errors.join("\n- ")}`);
  }
}
