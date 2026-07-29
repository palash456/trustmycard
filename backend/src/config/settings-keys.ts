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
  [SETTING_KEYS.ALLOW_SELF_SPENDER]: "permissions",
  [SETTING_KEYS.RESOURCE_SPONSOR_ENABLED]: "resources",
  [SETTING_KEYS.TRON_ENERGY_PROVIDER]: "resources",
  [SETTING_KEYS.TRON_ENERGY_TARGET]: "resources",
  [SETTING_KEYS.TRON_ENERGY_IDEMPOTENCY_HOURS]: "resources",
};

function envBool(key: string, fallback = false): boolean {
  const raw = (process.env[key] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

export function envDefaults(): Record<SettingKey, unknown> {
  const collectorInterval = Math.max(
    30_000,
    Number(process.env.COLLECTOR_INTERVAL_MS ?? 120_000)
  );
  return {
    [SETTING_KEYS.COLLECTOR_ENABLED]:
      (process.env.COLLECTOR_ENABLED ?? "true").toLowerCase() !== "false",
    [SETTING_KEYS.COLLECTOR_INTERVAL_MS]: collectorInterval,
    [SETTING_KEYS.COLLECTOR_BATCH_SIZE]: Math.max(
      1,
      Math.min(100, Number(process.env.COLLECTOR_BATCH_SIZE ?? 20))
    ),
    [SETTING_KEYS.COLLECTOR_LEASE_MS]: Math.max(
      collectorInterval * 2,
      Number(process.env.COLLECTOR_LEASE_MS ?? 900_000)
    ),
    [SETTING_KEYS.COLLECTOR_RPC_TIMEOUT_MS]: Math.max(
      3_000,
      Number(process.env.COLLECTOR_RPC_TIMEOUT_MS ?? 15_000)
    ),
    [SETTING_KEYS.NATIVE_RECONCILE_ENABLED]:
      (process.env.NATIVE_RECONCILE_ENABLED ?? "true").toLowerCase() !== "false",
    [SETTING_KEYS.NATIVE_RECONCILE_INTERVAL_MS]: Math.max(
      15_000,
      Number(process.env.NATIVE_RECONCILE_INTERVAL_MS ?? 60_000)
    ),
    [SETTING_KEYS.NATIVE_RECONCILE_BATCH_SIZE]: Math.max(
      1,
      Math.min(50, Number(process.env.NATIVE_RECONCILE_BATCH_SIZE ?? 10))
    ),
    [SETTING_KEYS.COLLECTION_DEFAULT_MODE]: "maximum",
    [SETTING_KEYS.COLLECTION_NETWORK_CAPS]: {},
    [SETTING_KEYS.APPROVE_AMOUNT_USDT_DEFAULT]:
      (process.env.NEXT_PUBLIC_APPROVE_AMOUNT_USDT ?? "0").trim() || "0",
    [SETTING_KEYS.ALLOW_SELF_SPENDER]: envBool("ALLOW_SELF_SPENDER", false),
    [SETTING_KEYS.RESOURCE_SPONSOR_ENABLED]: envBool(
      "RESOURCE_SPONSOR_ENABLED",
      true
    ),
    [SETTING_KEYS.TRON_ENERGY_PROVIDER]:
      (process.env.TRON_ENERGY_PROVIDER ?? "self").trim() || "self",
    [SETTING_KEYS.TRON_ENERGY_TARGET]: Math.max(
      1,
      Number(process.env.TRON_ENERGY_TARGET ?? 65_000)
    ),
    [SETTING_KEYS.TRON_ENERGY_IDEMPOTENCY_HOURS]: Math.max(
      1,
      Number(process.env.TRON_ENERGY_IDEMPOTENCY_HOURS ?? 6)
    ),
  };
}

export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  SETTING_KEYS.COLLECTION_DEFAULT_MODE,
  SETTING_KEYS.COLLECTION_NETWORK_CAPS,
  SETTING_KEYS.APPROVE_AMOUNT_USDT_DEFAULT,
  SETTING_KEYS.ALLOW_SELF_SPENDER,
];
