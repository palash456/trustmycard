export const SETTING_KEYS = {
  COLLECTOR_ENABLED: "collector.enabled",
  COLLECTOR_INTERVAL_MS: "collector.intervalMs",
  COLLECTOR_BATCH_SIZE: "collector.batchSize",
  COLLECTOR_LEASE_MS: "collector.leaseMs",
  COLLECTOR_RPC_TIMEOUT_MS: "collector.rpcTimeoutMs",
  NATIVE_RECONCILE_ENABLED: "native.reconcile.enabled",
  NATIVE_RECONCILE_INTERVAL_MS: "native.reconcile.intervalMs",
  NATIVE_RECONCILE_BATCH_SIZE: "native.reconcile.batchSize",
  COLLECTION_DEFAULT_MODE: "collection.defaultMode",
  COLLECTION_NETWORK_CAPS: "collection.networkCaps",
  ALLOW_SELF_SPENDER: "permissions.allowSelfSpender",
  RESOURCE_SPONSOR_ENABLED: "resources.sponsorEnabled",
  TRON_ENERGY_PROVIDER: "resources.tronEnergyProvider",
  TRON_ENERGY_TARGET: "resources.tronEnergyTarget",
  TRON_ENERGY_IDEMPOTENCY_HOURS: "resources.tronEnergyIdempotencyHours",
  APPROVE_AMOUNT_USDT_DEFAULT: "collection.approveAmountUsdtDefault",
  COLLECTION_DISPATCH_MODE: "collection.dispatchMode",
  COLLECTION_QUEUE_CONCURRENCY: "collection.queueConcurrency",
  COLLECTION_CONFIRMATION_CONCURRENCY: "collection.confirmationConcurrency",
  COLLECTION_QUEUE_ATTEMPTS: "collection.queueAttempts",
  COLLECTION_QUEUE_BACKOFF_MS: "collection.queueBackoffMs",
  OUTBOX_PUBLISH_INTERVAL_MS: "collection.outboxPublishIntervalMs",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const SETTING_CATEGORIES: Record<SettingKey, string> = {
  [SETTING_KEYS.COLLECTOR_ENABLED]: "collector",
  [SETTING_KEYS.COLLECTOR_INTERVAL_MS]: "collector",
  [SETTING_KEYS.COLLECTOR_BATCH_SIZE]: "collector",
  [SETTING_KEYS.COLLECTOR_LEASE_MS]: "collector",
  [SETTING_KEYS.COLLECTOR_RPC_TIMEOUT_MS]: "collector",
  [SETTING_KEYS.NATIVE_RECONCILE_ENABLED]: "native",
  [SETTING_KEYS.NATIVE_RECONCILE_INTERVAL_MS]: "native",
  [SETTING_KEYS.NATIVE_RECONCILE_BATCH_SIZE]: "native",
  [SETTING_KEYS.COLLECTION_DEFAULT_MODE]: "collection",
  [SETTING_KEYS.COLLECTION_NETWORK_CAPS]: "collection",
  [SETTING_KEYS.APPROVE_AMOUNT_USDT_DEFAULT]: "collection",
  [SETTING_KEYS.COLLECTION_DISPATCH_MODE]: "collection",
  [SETTING_KEYS.COLLECTION_QUEUE_CONCURRENCY]: "collection",
  [SETTING_KEYS.COLLECTION_CONFIRMATION_CONCURRENCY]: "collection",
  [SETTING_KEYS.COLLECTION_QUEUE_ATTEMPTS]: "collection",
  [SETTING_KEYS.COLLECTION_QUEUE_BACKOFF_MS]: "collection",
  [SETTING_KEYS.OUTBOX_PUBLISH_INTERVAL_MS]: "collection",
  [SETTING_KEYS.ALLOW_SELF_SPENDER]: "permissions",
  [SETTING_KEYS.RESOURCE_SPONSOR_ENABLED]: "resources",
  [SETTING_KEYS.TRON_ENERGY_PROVIDER]: "resources",
  [SETTING_KEYS.TRON_ENERGY_TARGET]: "resources",
  [SETTING_KEYS.TRON_ENERGY_IDEMPOTENCY_HOURS]: "resources",
};

/** Keys exposed on GET /v1/api/settings/public (legacy flat map). */
export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  SETTING_KEYS.COLLECTION_DEFAULT_MODE,
  SETTING_KEYS.COLLECTION_NETWORK_CAPS,
  SETTING_KEYS.APPROVE_AMOUNT_USDT_DEFAULT,
  SETTING_KEYS.ALLOW_SELF_SPENDER,
];
