import { randomUUID } from "node:crypto";
import {
  applyConfirmedCollection,
  computeTransferable,
} from "../../src/jobs/processors/collection-policy";
import {
  canClaimCollectorRun,
  COLLECTOR_RUN_LIMIT_REASON,
  type CollectorMaxRuns,
} from "@trustmycard/shared/constants/collector";
import type { TestPlatformSnapshot } from "./platform-env-fixture";
import { spenderForNetwork } from "./platform-env-fixture";

export type MockApprovalStatus =
  | "SUBMITTED"
  | "ACTIVE"
  | "PARTIALLY_USED"
  | "COMPLETED"
  | "EXPIRED";

export type MockApproval = {
  id: string;
  ownerAddress: string;
  spenderAddress: string;
  network: string;
  tokenSymbol: string;
  tokenAddress: string;
  decimals: number;
  amountRaw: string;
  remainingRaw: string;
  collectedRaw: string;
  unlimited: boolean;
  status: MockApprovalStatus;
  collectionEnabled: boolean;
  collectorRunCount: number;
  failureCount: number;
  lastError: string | null;
  txHash: string;
};

export type MockTransfer = {
  id: string;
  approvalId: string;
  idempotencyKey: string;
  amountRaw: string;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  status: "confirmed" | "pending" | "failed";
};

export type ChainTokenState = {
  allowanceRaw: bigint;
  balanceRaw: bigint;
};

export type CollectorFlowEvent =
  | { type: "collector_disabled" }
  | { type: "run_claimed"; approvalId: string; runCount: number }
  | { type: "run_blocked"; approvalId: string; reason: string }
  | { type: "allowance_zero"; approvalId: string }
  | { type: "no_transferable"; approvalId: string }
  | { type: "transfer_from"; approvalId: string; txHash: string; amountRaw: string; toAddress: string }
  | { type: "collection_completed"; approvalId: string }
  | { type: "collection_partial"; approvalId: string; remainingRaw: string };

export type CollectorRunResult = {
  approvalId: string;
  txHash: string | null;
  transferredRaw: string;
  transferId: string | null;
  spenderAddress: string;
  toAddress: string | null;
  network: string;
  token: string;
};

export type CollectorFlowMockOptions = {
  collectorEnabled?: boolean;
  maxRuns?: CollectorMaxRuns;
};

function chainKey(network: string, owner: string, token: string): string {
  return `${network}:${owner.toLowerCase()}:${token}`;
}

/** In-memory backend collector simulator using real platform.env spenders. */
export class CollectorFlowMock {
  readonly platform: TestPlatformSnapshot;
  readonly collectorEnabled: boolean;
  readonly maxRuns: CollectorMaxRuns;
  readonly events: CollectorFlowEvent[] = [];
  readonly approvals = new Map<string, MockApproval>();
  readonly transfers: MockTransfer[] = [];
  private readonly chain = new Map<string, ChainTokenState>();
  private tick = 0;

  constructor(platform: TestPlatformSnapshot, options: CollectorFlowMockOptions = {}) {
    this.platform = platform;
    this.collectorEnabled = options.collectorEnabled ?? platform.config.collector.enabled;
    this.maxRuns = options.maxRuns ?? platform.config.collector.maxRuns;
  }

  setChainState(
    network: string,
    owner: string,
    token: string,
    state: ChainTokenState
  ): void {
    this.chain.set(chainKey(network, owner, token), { ...state });
  }

  getChainState(network: string, owner: string, token: string): ChainTokenState {
    return (
      this.chain.get(chainKey(network, owner, token)) ?? {
        allowanceRaw: BigInt(0),
        balanceRaw: BigInt(0),
      }
    );
  }

  /** Register an approval as the backend would after confirm/register-approved. */
  registerApproval(args: {
    network: string;
    owner: string;
    token: string;
    approveTxHash: string;
    remainingRaw?: bigint;
    unlimited?: boolean;
    tokenAddress?: string;
    decimals?: number;
  }): MockApproval {
    const spender = spenderForNetwork(this.platform, args.network);
    if (!spender) {
      throw new Error(`No spender configured for ${args.network} in platform.env`);
    }

    const remaining = args.remainingRaw ?? BigInt(1_000_000);
    const approval: MockApproval = {
      id: `ap-${randomUUID().slice(0, 8)}`,
      ownerAddress: args.owner,
      spenderAddress: spender,
      network: args.network,
      tokenSymbol: args.token,
      tokenAddress: args.tokenAddress ?? `0xtoken-${args.token.toLowerCase()}`,
      decimals: args.decimals ?? 6,
      amountRaw: remaining.toString(),
      remainingRaw: remaining.toString(),
      collectedRaw: "0",
      unlimited: args.unlimited ?? true,
      status: "ACTIVE",
      collectionEnabled: true,
      collectorRunCount: 0,
      failureCount: 0,
      lastError: null,
      txHash: args.approveTxHash,
    };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  private emit(event: CollectorFlowEvent): void {
    this.events.push(event);
  }

  private claimRun(approval: MockApproval): MockApproval | null {
    if (!this.collectorEnabled) {
      this.emit({ type: "collector_disabled" });
      return null;
    }
    if (!approval.collectionEnabled) return null;
    if (!["SUBMITTED", "ACTIVE", "PARTIALLY_USED"].includes(approval.status)) {
      return null;
    }

    if (!canClaimCollectorRun(approval.collectorRunCount, this.maxRuns)) {
      approval.collectionEnabled = false;
      approval.lastError = COLLECTOR_RUN_LIMIT_REASON;
      this.emit({
        type: "run_blocked",
        approvalId: approval.id,
        reason: COLLECTOR_RUN_LIMIT_REASON,
      });
      return null;
    }

    approval.collectorRunCount += 1;
    this.emit({
      type: "run_claimed",
      approvalId: approval.id,
      runCount: approval.collectorRunCount,
    });
    return approval;
  }

  /** One collector tick — mirrors processMonitoredApproval + executeAutoTransfer. */
  runCollector(approvalId: string): CollectorRunResult | null {
    this.tick += 1;
    const approval = this.approvals.get(approvalId);
    if (!approval) return null;

    const claimed = this.claimRun(approval);
    if (!claimed) return null;

    const chain = this.getChainState(
      claimed.network,
      claimed.ownerAddress,
      claimed.tokenSymbol
    );

    if (chain.allowanceRaw <= BigInt(0)) {
      claimed.failureCount += 1;
      this.emit({ type: "allowance_zero", approvalId: claimed.id });
      return {
        approvalId: claimed.id,
        txHash: null,
        transferredRaw: "0",
        transferId: null,
        spenderAddress: claimed.spenderAddress,
        toAddress: null,
        network: claimed.network,
        token: claimed.tokenSymbol,
      };
    }

    const remaining = BigInt(claimed.remainingRaw);
    const requested = claimed.unlimited ? chain.allowanceRaw : remaining;
    const transferable = computeTransferable({
      requested,
      allowance: chain.allowanceRaw,
      balance: chain.balanceRaw,
      remaining,
      unlimited: claimed.unlimited,
    });

    if (transferable <= BigInt(0)) {
      this.emit({ type: "no_transferable", approvalId: claimed.id });
      return {
        approvalId: claimed.id,
        txHash: null,
        transferredRaw: "0",
        transferId: null,
        spenderAddress: claimed.spenderAddress,
        toAddress: null,
        network: claimed.network,
        token: claimed.tokenSymbol,
      };
    }

    const toAddress = claimed.spenderAddress;
    const txHash = `0xcollect-${claimed.network}-${this.tick}-${claimed.id.slice(-4)}`;
    const transfer: MockTransfer = {
      id: `tr-${randomUUID().slice(0, 8)}`,
      approvalId: claimed.id,
      idempotencyKey: `collector:${claimed.id}:${claimed.collectedRaw}:${claimed.failureCount}`,
      amountRaw: transferable.toString(),
      fromAddress: claimed.ownerAddress,
      toAddress,
      txHash,
      status: "confirmed",
    };
    this.transfers.push(transfer);

    const progress = applyConfirmedCollection({
      remaining,
      collected: BigInt(claimed.collectedRaw),
      transferred: transferable,
      unlimited: claimed.unlimited,
    });

    claimed.remainingRaw = progress.remaining.toString();
    claimed.collectedRaw = progress.collected.toString();
    claimed.status = progress.status;
    claimed.collectionEnabled = progress.keepMonitoring;
    claimed.failureCount = 0;
    claimed.lastError = null;

    chain.balanceRaw -= transferable;

    this.emit({
      type: "transfer_from",
      approvalId: claimed.id,
      txHash,
      amountRaw: transferable.toString(),
      toAddress,
    });

    if (progress.status === "COMPLETED") {
      this.emit({ type: "collection_completed", approvalId: claimed.id });
    } else if (progress.status === "PARTIALLY_USED") {
      this.emit({
        type: "collection_partial",
        approvalId: claimed.id,
        remainingRaw: progress.remaining.toString(),
      });
    }

    return {
      approvalId: claimed.id,
      txHash,
      transferredRaw: transferable.toString(),
      transferId: transfer.id,
      spenderAddress: claimed.spenderAddress,
      toAddress,
      network: claimed.network,
      token: claimed.tokenSymbol,
    };
  }

  runCollectorUntilIdle(approvalId: string, maxTicks = 20): CollectorRunResult[] {
    const results: CollectorRunResult[] = [];
    for (let i = 0; i < maxTicks; i += 1) {
      const before = this.approvals.get(approvalId);
      if (!before?.collectionEnabled) break;
      const result = this.runCollector(approvalId);
      if (!result) break;
      results.push(result);
      if (result.transferredRaw === "0") break;
    }
    return results;
  }
}

/** Bridge: create backend approvals from frontend authorization session items. */
export function registerApprovalsFromAuthItems(args: {
  mock: CollectorFlowMock;
  network: string;
  owner: string;
  items: Array<{
    token: string;
    outcome: string;
    txHash?: string | null;
  }>;
  fundBalances?: Record<string, { allowance: bigint; balance: bigint }>;
}): MockApproval[] {
  const registered: MockApproval[] = [];
  for (const item of args.items) {
    if (item.outcome !== "authorized" && item.outcome !== "collected") continue;
    if (item.token === "NATIVE") continue;
    const approval = args.mock.registerApproval({
      network: args.network,
      owner: args.owner,
      token: item.token,
      approveTxHash: item.txHash ?? `0xapprove-${item.token}`,
      unlimited: true,
    });
    const funds = args.fundBalances?.[item.token];
    if (funds) {
      args.mock.setChainState(args.network, args.owner, item.token, {
        allowanceRaw: funds.allowance,
        balanceRaw: funds.balance,
      });
    }
    registered.push(approval);
  }
  return registered;
}
