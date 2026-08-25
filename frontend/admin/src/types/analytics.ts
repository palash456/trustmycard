export type NetworkTokenAmount = {
  network: string;
  tokenSymbol: string;
  raw: string;
  human: string;
  decimals: number;
  count?: number;
};

export type DailyPoint = { date: string; count: number; value?: string };

export type AnalyticsInsight = {
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  metric?: string;
  href?: string;
};

export type AnalyticsActivityItem = {
  type: string;
  id: string;
  at: string;
  label: string;
  status: string;
  address: string;
  network: string;
  href: string;
};

export type ChainMetrics = {
  network: string;
  wallets: number;
  approvals: number;
  transfers: number;
  collections: number;
  volume: NetworkTokenAmount[];
  revenue: NetworkTokenAmount[];
  pending: NetworkTokenAmount[];
  failed: NetworkTokenAmount[];
  successRate: number;
  failureRate: number;
  averageCompletionTimeMs: number | null;
};

export type TokenMetrics = {
  tokenSymbol?: string;
  volume: Array<{
    network: string;
    raw?: string;
    human?: string;
    count?: number;
    assetSymbol?: string;
    amountRaw?: string;
  }>;
  volumeTotal?: { raw: string; human: string };
  collections: number;
  averageCollection?: string;
  successRate: number;
  pendingValue?: NetworkTokenAmount[];
  failedCount: number;
};

export type AnalyticsResponse = {
  period: {
    preset: string;
    start: string | null;
    end: string;
    previousStart: string | null;
    previousEnd: string | null;
  };
  revenue: {
    platformVolume: {
      stablecoin: NetworkTokenAmount[];
      nativeTransferCount: number;
    };
    collected: {
      period: NetworkTokenAmount[];
      lifetime: NetworkTokenAmount[];
      today: NetworkTokenAmount[];
      thisWeek: NetworkTokenAmount[];
      thisMonth: NetworkTokenAmount[];
    };
    pending: NetworkTokenAmount[];
    failed: NetworkTokenAmount[];
    lost: NetworkTokenAmount[];
    recoverable: NetworkTokenAmount[];
    estimatedPotential: NetworkTokenAmount[];
    averages: {
      perUser: { ownerCount: number; note: string } | null;
      perCollection: { confirmedCount: number; note: string } | null;
    };
    extremes: {
      largestCollection: {
        amountRaw: string;
        human: string;
        network: string;
        tokenSymbol: string;
        address: string;
      } | null;
      largestUser: {
        address: string;
        amountRaw: string;
        human: string;
        network: string;
        tokenSymbol: string;
      } | null;
      highestPendingUser: {
        address: string;
        amountRaw: string;
        human: string;
        network: string;
        tokenSymbol: string;
      } | null;
    };
    confirmedTransferCount: number;
    periodConfirmedCount: number;
  };
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    newInPeriod: number;
    returningInPeriod: number;
    activeWallets: number;
    abandonedWallets: number;
    workflowStages: {
      waitingForApproval: number;
      readyForCollection: number;
      currentlyCollecting: number;
      successfullyCompleted: number;
      failed: number;
    };
    growthSeries: DailyPoint[];
  };
  approvals: {
    total: number;
    successful: number;
    failed: number;
    revoked: number;
    expired: number;
    pending: number;
    successRate: number;
    failureRate: number;
    averageApprovalTimeMs: number | null;
    byChain: Record<string, number>;
    byToken: Record<string, number>;
    series: { daily: DailyPoint[] };
    counts: Record<string, number>;
  };
  collections: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    partial: number;
    retryCollections: number;
    successRate: number;
    averageCollectionTimeMs: number | null;
    averageRetryCount: number;
    averageCollectionValueRaw: string | null;
    highest: {
      amountRaw: string;
      human: string;
      network: string;
      tokenSymbol: string;
    } | null;
    lowest: {
      amountRaw: string;
      human: string;
      network: string;
      tokenSymbol: string;
    } | null;
    byChain: Record<string, number>;
    byToken: Record<string, number>;
    series: { daily: DailyPoint[] };
    counts: Record<string, number>;
  };
  transfers: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    broadcast: number;
    confirmed: number;
    averageConfirmationTimeMs: number | null;
    retryCount: number;
    successRate: number;
    counts: Record<string, number>;
    volumeSeries: Array<{ date: string; count: number; volumeRaw: string }>;
  };
  nativeFunding: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    averageAmountRaw: string | null;
    averageFundingTimeMs: number | null;
    successRate: number;
    reconciliationSuccessRate: number;
    failedReconciliations: number;
    totalGasFeesRaw: string | null;
    byChain: Record<string, number>;
    successTrend: Array<{
      date: string;
      total: number;
      confirmed: number;
      rate: number;
    }>;
    counts: Record<string, number>;
  };
  chains: ChainMetrics[];
  tokens: {
    usdt: TokenMetrics;
    usdc: TokenMetrics;
    native: TokenMetrics;
  };
  failures: {
    totalFailures: number;
    revenueLost: NetworkTokenAmount[];
    recoverableRevenue: NetworkTokenAmount[];
    unrecoverableRevenue: NetworkTokenAmount[];
    failedApprovals: number;
    failedTransfers: number;
    failedNativeFunding: number;
    failedReconciliation: number;
    rpcFailures: number;
    timeoutFailures: number;
    unknownErrors: number;
    topFailureReasons: Array<{ reason: string; count: number }>;
    failureTrend: DailyPoint[];
    failureRateByChain: Record<string, number>;
    failureRateByToken: Record<string, number>;
  };
  health: {
    overallHealth: "healthy" | "warning" | "critical";
    healthyWallets: number;
    warningWallets: number;
    failedWallets: number;
    stuckTransactions: number;
    longPendingTransactions: number;
    queueBacklog: number;
    collectorHealth: {
      enabled: boolean;
      due: number;
      leased: number;
      running: boolean;
      lastTickAt: string | null;
    };
    workerHealth: { workerId: string | null; intervalMs: number };
    schedulerHealth: {
      backgroundJobs: Record<string, unknown>;
      collector: Record<string, unknown>;
      nativeReconcile: Record<string, unknown>;
    };
    stuckLeases: number;
  };
  performance: {
    averageEndToEndMs: number | null;
    connectToApprovalMs: number | null;
    approvalToCollectionMs: number | null;
    collectionToConfirmationMs: number | null;
    averageLifecycleMs: number | null;
    fastestCollectionMs: number | null;
    slowestCollectionMs: number | null;
    bottleneck: string | null;
    stages: Array<{ stage: string; ms: number }>;
  };
  leaderboards: {
    topWalletsByValue: Array<{
      address: string;
      username?: string | null;
      userPublicId?: string | null;
      amountRaw: string;
      human: string;
      network: string;
      tokenSymbol: string;
      href: string;
    }>;
    topChainsByVolume: Array<{ network: string; volumeRaw: string }>;
    topTokensByVolume: Array<{ tokenSymbol: string; volumeRaw: string }>;
    largestCollections: Array<{
      id: string;
      address: string;
      amountRaw: string;
      human: string;
      network: string;
      tokenSymbol: string;
      href: string;
    }>;
    largestPendingWallets: Array<{
      address: string;
      username?: string | null;
      userPublicId?: string | null;
      amountRaw: string;
      human: string;
      network: string;
      tokenSymbol: string;
      href: string;
    }>;
    highestFailureWallets: Array<{
      address: string;
      username?: string | null;
      userPublicId?: string | null;
      failures: number;
      href: string;
    }>;
    mostActiveWallets: Array<{
      address: string;
      username?: string | null;
      userPublicId?: string | null;
      activityCount: number;
      href: string;
    }>;
  };
  insights: AnalyticsInsight[];
  generatedAt: string;
  meta?: {
    cached?: boolean;
    cacheTtlSec?: number;
    dbConcurrency?: number;
  };
};

export type AnalyticsActivityResponse = {
  items: AnalyticsActivityItem[];
};
