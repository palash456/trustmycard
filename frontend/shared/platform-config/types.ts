/** Public platform configuration exposed by GET /v1/api/settings/public */
export type PublicPlatformConfig = {
  wallets: {
    spenderEvm: string;
    spenderTron: string;
  };
  approval: {
    approveAmountUsdtDefault: string;
    termsVersion: string;
    allowSelfSpender: boolean;
    tronApproveFeeLimitSun: number;
    verifyIntervalMs: number;
    verifyMaxAttempts: number;
    postConfirmDelayEvmMs: number;
    postConfirmDelayTronMs: number;
  };
  collection: {
    defaultMode: string;
    networkCaps: Record<string, unknown>;
  };
  native: {
    transferLockTtlMs: number;
    confirmRetryDelaysMs: number[];
    registerRetryDelaysMs: number[];
    estimateMaxUnderflowBps: number;
    txVisibilityMaxAttempts: number;
    txVisibilityBaseDelayMs: number;
  };
  client: {
    confirmationPollMs: number;
    confirmationMaxAttempts: number;
    confirmationConfirmations: number;
    resourcePollMinDelayMs: number;
    resourcePollMaxDelayMs: number;
  };
  transfer: {
    evmTxConfirmTimeoutMs: number;
    allowancePollDelayEvmMs: number;
    allowancePollDelayTronMs: number;
    confirmationRetryDelayMs: number;
    tronTxConfirmMaxAttempts: number;
    tronTxConfirmPollMs: number;
    evmGasLimitBufferNumerator: number;
    evmGasLimitBufferDenominator: number;
  };
  chains: {
    tronFullHost: string;
    enabledNetworks: string[];
  };
  featureFlags: {
    collectorEnabled: boolean;
    collectorMaxRuns: number | null;
    nativeReconcileEnabled: boolean;
    resourceSponsorEnabled: boolean;
  };
};

export type PublicPlatformConfigResponse = {
  ok: boolean;
  config: PublicPlatformConfig;
  settings: Record<string, unknown>;
  timestamp: string;
};
