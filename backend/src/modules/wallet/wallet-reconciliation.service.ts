import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { getErrorMessage } from "../../common/utils/error-message";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { incrementCounter } from "@trustmycard/shared/observability";
import { prisma } from "../../infrastructure/database/prisma-shared";
import { WalletNotifyService } from "./wallet-notify.service";
import { WalletTransferExecutorService } from "./wallet-transfer-executor.service";

@Injectable()
export class WalletReconciliationService {
  constructor(
    private readonly notify: WalletNotifyService,
    private readonly transferExecutor: WalletTransferExecutorService,
    private readonly logger: StructuredLoggerService,
  ) {}

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
        await this.notify.recordTransferExecutedAudit({
          approvalId: row.approvalId,
          transferId: row.id,
          network: row.approval.network,
          token: row.approval.tokenSymbol,
          amountRaw: row.amountRaw,
          txHash: row.txHash,
          toAddress: row.toAddress,
        });
      }
      this.notify.notifyTransferUpdated({
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
      this.notify.notifyTransferUpdated({
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
        await this.notify.recordTransferExecutedAudit({
          approvalId: transfer.approvalId,
          transferId: transfer.id,
          network: transfer.approval.network,
          token: transfer.approval.tokenSymbol,
          amountRaw: transfer.amountRaw,
          txHash: transfer.txHash,
          toAddress: transfer.toAddress,
        });
      }
      this.notify.notifyTransferUpdated({
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
      transferToAddress: transfer.toAddress,
      requestedRaw: BigInt(transfer.amountRaw),
      allowanceRaw: BigInt(transfer.amountRaw),
      idempotencyKey: transfer.idempotencyKey,
    });

    const item = await prisma.transfer.findUniqueOrThrow({
      where: { id: executed.transferId },
      include: { approval: true },
    });
    this.notify.notifyTransferUpdated({
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
}
