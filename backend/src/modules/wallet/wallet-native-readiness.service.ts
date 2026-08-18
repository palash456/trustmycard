import { BadRequestException, forwardRef, Inject, Injectable } from "@nestjs/common";
import { TOKEN_SETTLEMENT_ORDER } from "@trustmycard/shared/constants/settlement";
import {
  isTokenCollectionBlockingNative,
  resolveTokenCollectionState,
  summarizeNativeReadiness,
  TOKEN_COLLECTION_STATE_LABELS,
  type TokenCollectionLogicalState,
  type TokenCollectionSnapshot,
} from "@trustmycard/shared/constants/token-collection-state";
import { TRANSFER_SKIP_REASONS } from "@trustmycard/shared/constants/collection";
import { prisma } from "../../infrastructure/database/prisma-shared";
import { ownerAddressFilter } from "./wallet-crypto.util";
import { WalletNotifyService } from "./wallet-notify.service";
import { WalletApprovalService } from "./wallet-approval.service";
import { WalletCollectionService } from "./wallet-collection.service";

@Injectable()
export class WalletNativeReadinessService {
  constructor(
    private readonly notify: WalletNotifyService,
    @Inject(forwardRef(() => WalletApprovalService))
    private readonly approval: WalletApprovalService,
    @Inject(forwardRef(() => WalletCollectionService))
    private readonly collection: WalletCollectionService,
  ) {}

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
      args.tokens && args.tokens.length > 0
        ? args.tokens
        : await this.defaultNativeReadinessTokenInputs(
            args.ownerAddress,
            args.network,
          );

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
          lastError,
        ),
        approvalId: loaded.approvalId,
        lastError,
      });
    }

    const summary = summarizeNativeReadiness(results);
    this.notify.logFlow("NATIVE READINESS RESULT", {
      owner,
      network,
      canExecuteNative: summary.canExecuteNative,
      tokens: results.map((t) => ({
        token: t.token,
        state: t.state,
        active: t.active,
        lastError: t.lastError,
      })),
    });
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
      tokens && tokens.length > 0
        ? tokens
        : await this.defaultNativeReadinessTokenInputs(ownerAddress, network);

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

  async defaultNativeReadinessTokenInputs(
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

  async loadTokenCollectionSnapshot(args: {
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
      await this.approval.reconcileApprovalFromSiblingTransfer(approvalId);
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
              ...ownerAddressFilter(args.owner, args.network),
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
}
