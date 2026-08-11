import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CollectionIntentStatus,
  TransferAttemptStatus,
} from "@prisma/client";
import { TronWeb } from "tronweb";
import {
  applyConfirmedCollection,
  computeTransferable,
} from "../../jobs/processors/collection-policy";
import {
  allocatePublicId,
  journeyWriteFields,
  normalizeJourneyId,
  tokenQualifier,
} from "../../common/ids/public-id.helper";
import { getErrorMessage } from "../../common/utils/error-message";
import { CollectionIntentService } from "../collections/collection-intent.service";
import { ConfigService } from "../../config/config.service";
import { resolveApprovalStateAfterAllowanceCheck } from "./approval-state-sync";
import { PlatformConfigService } from "../../config/platform-config.service";
import { TRANSFER_SKIP_REASONS } from "@trustmycard/shared/constants/collection";
import {
  COLLECTOR_RUN_LIMIT_REASON,
} from "@trustmycard/shared/constants/collector";
import {
  isTokenCollectionBlockingNative,
  resolveTokenCollectionState,
} from "@trustmycard/shared/constants/token-collection-state";
import { prisma } from "../../infrastructure/database/prisma-shared";
import {
  MAX_UINT256,
  TRON_GRID,
  sleep,
  type EvmChainKey,
  type TokenSymbol,
} from "./wallet.constants";
import {
  getToken,
  humanizeCollectorGasError,
  isCollectorGasError,
  ownerAddressFilter,
  parseToken,
  tokenBalanceIsZero,
} from "./wallet-crypto.util";
import { WalletNotifyService } from "./wallet-notify.service";
import { WalletRpcService } from "./wallet-rpc.service";
import { WalletCollectorContextService } from "./wallet-collector-context.service";
import { WalletTransferExecutorService } from "./wallet-transfer-executor.service";
import { WalletApprovalService } from "./wallet-approval.service";
import { WalletNativeReadinessService } from "./wallet-native-readiness.service";

@Injectable()
export class WalletCollectionService {
  constructor(
    private readonly notify: WalletNotifyService,
    private readonly rpc: WalletRpcService,
    private readonly collectorContext: WalletCollectorContextService,
    private readonly platformConfig: PlatformConfigService,
    private readonly configService: ConfigService,
    private readonly collectionIntents: CollectionIntentService,
    private readonly transferExecutor: WalletTransferExecutorService,
    @Inject(forwardRef(() => WalletApprovalService))
    private readonly approval: WalletApprovalService,
    @Inject(forwardRef(() => WalletNativeReadinessService))
    private readonly nativeReadiness: WalletNativeReadinessService,
  ) {}

  private async claimCollectorRun(approvalId: string) {
    const maxRuns = this.collectorContext.collectorMaxRuns();
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
      this.notify.logFlow("COLLECTOR MAX RUNS REACHED", {
        approvalId,
        collectorRunCount: approval.collectorRunCount,
        maxRuns,
        network: approval.network,
        ownerAddress: approval.ownerAddress,
      });
    }
    return null;
  }
  triggerImmediateCollection(approvalId: string): void {
    void this.runImmediateCollection(approvalId).catch((err) => {
      this.notify.logFlow("IMMEDIATE COLLECTION FAILED", {
        approvalId,
        error: getErrorMessage(err),
      });
    });
  }

  async runImmediateCollection(approvalId: string): Promise<void> {
    await this.processMonitoredApproval(approvalId);
  }

  /** Retry immediate collection when confirm saw on-chain balance but first transferFrom read zero. */
  async runImmediateCollectionWithRetries(
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

  pendingCollectionIntentStatuses(): CollectionIntentStatus[] {
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
  async markCollectionNothingToCollect(
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
  async scheduleUnlimitedDepositWatch(
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
        ? this.collectorContext.nextCollectionCheck(args.failureCount)
        : this.collectorContext.nextZeroBalanceRetryCheck(args.failureCount + 1, network);
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
      args.tokens && args.tokens.length > 0
        ? args.tokens
        : await this.nativeReadiness.defaultNativeReadinessTokenInputs(owner, network);

    const nudged: Array<{
      token: string;
      approvalId: string | null;
      state: string;
    }> = [];

    for (const input of tokenInputs) {
      if (!input.shouldAttemptTransfer) continue;

      const loaded = await this.nativeReadiness.loadTokenCollectionSnapshot({
        owner,
        network,
        token: input.token,
        shouldAttemptTransfer: input.shouldAttemptTransfer,
        approvalId: input.approvalId,
        approvalTxHash: input.approvalTxHash,
      });
      const state = resolveTokenCollectionState(loaded.snapshot);
      const lastError = loaded.snapshot.approval?.lastError ?? null;
      if (
        !isTokenCollectionBlockingNative(
          state,
          input.shouldAttemptTransfer,
          lastError,
        )
      ) {
        continue;
      }
      if (!loaded.approvalId) continue;

      await this.processMonitoredApproval(loaded.approvalId).catch((err) => {
        this.notify.logFlow("COLLECTION NUDGE FAILED", {
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
    const token = parseToken(body.token);
    const traceId = normalizeJourneyId(String(body.traceId ?? ""));
    const unlimited = Boolean(body.unlimited);
    if (!network || !owner)
      throw new BadRequestException("network and owner are required");

    const tokenInfo = getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported token/network");
    const spender = this.rpc.spenderFor(network);
    if (!spender) throw new BadRequestException("Spender not configured");

    const verified = await this.approval.verifyAllowance({
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
    const isZeroBalance = tokenBalanceIsZero(tokenBalanceHuman);
    const executeTransfer =
      Boolean(body.executeTransfer) && !isZeroBalance;
    const zeroBalanceSkipError =
      !executeTransfer && isZeroBalance
        ? TRANSFER_SKIP_REASONS.zero_balance_collect_later
        : null;
    const transferToAddress = this.collectorContext.collectionDestinationFor(owner, network);
    const transferAmountRawInput = String(body.transferAmountRaw ?? "").trim();
    const requestedTransferRaw = transferAmountRawInput
      ? BigInt(transferAmountRawInput)
      : unlimited
        ? onChain
        : BigInt(amountRaw);
    const immediateCollectionAt = new Date();
    const syntheticTxHash = `allowance-sync:${network}:${owner.toLowerCase()}:${token}`;

    this.notify.logFlow("QUEUE COLLECTION FROM ALLOWANCE", {
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
            ...ownerAddressFilter(owner, network),
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
      transferSkippedReason = isZeroBalance
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

    await this.notify.recordAudit(
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
      const settledBalance = await this.rpc.readTokenBalanceRaw(
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
        const verified = await this.approval.verifyAllowance({
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
            nextCheckAt: this.collectorContext.nextCollectionCheck(nextFailures),
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

    const ownerBalanceNow = await this.rpc.readTokenBalanceRaw(
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
      await this.transferExecutor.executeAutoTransfer({
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
          const ownerBalance = await this.rpc.readTokenBalanceRaw(
            activeApproval.network,
            activeApproval.ownerAddress,
            activeApproval.tokenSymbol as TokenSymbol,
          );
          if (ownerBalance <= BigInt(0)) {
            const reconciled = await this.approval.reconcileApprovalFromSiblingTransfer(
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
          this.notify.logFlow("COLLECTION BALANCE RECHECK FAILED", {
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
            : humanizeCollectorGasError(activeApproval.network, message, this.rpc.spenderFor(activeApproval.network)),
          failureCount: nextFailures,
          nextCheckAt: this.collectorContext.nextCollectionCheck(nextFailures),
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
      this.notify.notifyCollectionIntentUpdated({
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
      this.notify.notifyCollectionIntentUpdated({
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
      this.notify.notifyCollectionIntentUpdated({
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
      const allowance = await this.approval.verifyAllowance({
        network: approval.network,
        owner: approval.ownerAddress,
        spender: approval.spenderAddress,
        token: approval.tokenSymbol,
      });
      const allowanceRaw = BigInt(allowance.allowance);
      const balanceRaw = await this.rpc.readTokenBalanceRaw(
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
        this.notify.notifyCollectionIntentUpdated({
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
          ? await this.transferExecutor.executeTronTransferFrom({
              transferId: transfer.id,
              approvalId: approval.id,
              network: approval.network,
              tokenAddress: approval.tokenAddress,
              owner: approval.ownerAddress,
              to: intent.spenderAddress,
              amountRaw: amount,
              waitForConfirmation: false,
            })
          : await this.transferExecutor.executeEvmTransferFrom({
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
      this.notify.notifyCollectionIntentUpdated({
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
      this.notify.notifyCollectionIntentUpdated({
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
      this.notify.notifyCollectionIntentUpdated({
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
      const receipt = (await this.rpc.evmRpcCall(
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
      this.notify.notifyCollectionIntentUpdated({
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
            ? this.collectorContext.nextCollectionCheck()
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
    this.notify.notifyCollectionIntentUpdated({
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

    const verified = await this.approval.verifyAllowance({
      network: approval.network,
      owner: approval.ownerAddress,
      spender: approval.spenderAddress,
      token: approval.tokenSymbol,
    });

    try {
      const executed = await this.transferExecutor.executeAutoTransfer({
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

}
