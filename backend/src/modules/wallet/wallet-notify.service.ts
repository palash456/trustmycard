import { Injectable } from "@nestjs/common";
import { CollectionIntentStatus, type Prisma } from "@prisma/client";
import { safeCreateAuditLog } from "../../common/audit/safe-audit";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { AdminEventsService } from "../../infrastructure/admin-events/admin-events.service";
import type { LogStatus } from "@trustmycard/shared/observability";
import { incrementCounter } from "@trustmycard/shared/observability";
import { ObservabilityService } from "../observability/observability.service";
import { prisma } from "../../infrastructure/database/prisma-shared";
import { WALLET_SERVICE_JOURNEY_STAGES } from "./wallet.constants";

@Injectable()
export class WalletNotifyService {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly observability: ObservabilityService,
    private readonly adminEvents: AdminEventsService,
  ) {}

  logFlow(stage: string, payload: Record<string, unknown> = {}): void {
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

  async recordAudit(
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

  async recordTransferExecutedAudit(args: {
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

  notifyTransferUpdated(args: {
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

  notifyApprovalUpdated(args: {
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

  notifyCollectionIntentUpdated(args: {
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

  captureFlowLog(body: Record<string, unknown>) {
    this.logFlow("FRONTEND FLOW EVENT", body);
    return { ok: true };
  }
}
