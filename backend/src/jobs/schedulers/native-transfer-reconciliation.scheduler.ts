import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import {
  getErrorMessage,
  incrementCounter,
  recordTiming,
} from "@trustmycard/shared/observability";
import { ConfigService } from "../../config/config.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { WalletService } from "../../modules/wallet/wallet.service";
import { NativeTransferService } from "../../modules/wallet/native-transfer.service";

const prisma = new PrismaClient();

@Injectable()
export class NativeTransferReconciliationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private runtimeEnabled = true;
  private lastTickAt: Date | null = null;

  constructor(
    private readonly nativeTransferService: NativeTransferService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService
  ) {}

  onModuleInit(): void {
    void this.walletService.repairInconsistentConfirmedTransfers();
    this.configService.events.on("settings.updated", () => {
      this.updateFromConfig();
    });
    this.updateFromConfig();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await prisma.$disconnect();
  }

  getStatus() {
    const cfg = this.configService.getNativeReconcileConfig();
    return {
      running: Boolean(this.timer),
      runtimeEnabled: this.runtimeEnabled,
      configEnabled: cfg.enabled,
      effectiveEnabled: cfg.enabled && this.runtimeEnabled,
      intervalMs: cfg.intervalMs,
      batchSize: cfg.batchSize,
      lastTickAt: this.lastTickAt?.toISOString() ?? null,
    };
  }

  setRuntimeEnabled(enabled: boolean): void {
    this.runtimeEnabled = enabled;
    this.updateFromConfig();
  }

  updateFromConfig(): void {
    const cfg = this.configService.getNativeReconcileConfig();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!cfg.enabled || !this.runtimeEnabled) {
      this.logger.emit({
        level: "info",
        module: "reconciliation",
        operation: "native_transfer_reconcile",
        stage: "DISABLED",
        status: "skipped",
        message: "Native transfer reconciliation is disabled",
        skipSampling: true,
      });
      return;
    }
    this.logger.emit({
      level: "info",
      module: "reconciliation",
      operation: "native_transfer_reconcile",
      stage: "ENABLED",
      status: "success",
      message: "Native transfer reconciliation enabled",
      context: { intervalMs: cfg.intervalMs, batchSize: cfg.batchSize },
      skipSampling: true,
    });
    this.timer = setInterval(() => void this.tick(), cfg.intervalMs);
    this.timer.unref();
  }

  async forceTick(): Promise<void> {
    await this.tick();
  }

  private cfg() {
    return this.configService.getNativeReconcileConfig();
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    const cfg = this.cfg();
    if (!cfg.enabled || !this.runtimeEnabled) return;
    this.running = true;
    this.lastTickAt = new Date();
    const start = Date.now();
    try {
      await this.walletService.repairInconsistentConfirmedTransfers(cfg.batchSize);

      const broadcast = await prisma.transfer.findMany({
        where: { status: "broadcast", confirmedAt: null },
        orderBy: { broadcastAt: "asc" },
        take: cfg.batchSize,
        select: { id: true, txHash: true, approval: { select: { network: true } } },
      });

      for (const record of broadcast) {
        const itemStart = Date.now();
        try {
          await this.walletService.reconcileTransfer(record.id);
          incrementCounter("collector.transfers.completed", {
            network: record.approval.network,
            status: "reconciled",
          });
        } catch (err) {
          this.logger.emit({
            level: "warn",
            module: "reconciliation",
            operation: "token_transfer_reconcile",
            stage: "RECONCILE_FAILED",
            status: "failure",
            message: getErrorMessage(err, "Token transfer reconcile failed"),
            txHash: record.txHash ?? undefined,
            network: record.approval.network,
            durationMs: Date.now() - itemStart,
            err,
          });
        }
      }

      const pending = await prisma.nativeTransfer.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: cfg.batchSize,
      });

      for (const record of pending) {
        const itemStart = Date.now();
        try {
          await this.nativeTransferService.reconcilePending(record.id);
          incrementCounter("native_transfers.total", {
            network: record.network,
            status: "reconciled",
          });
        } catch (err) {
          this.logger.emit({
            level: "warn",
            module: "reconciliation",
            operation: "native_transfer_reconcile",
            stage: "RECONCILE_FAILED",
            status: "failure",
            message: getErrorMessage(err, "Reconcile failed"),
            txHash: record.txHash,
            network: record.network,
            walletAddress: record.ownerAddress,
            durationMs: Date.now() - itemStart,
            err,
          });
        }
      }
      recordTiming("reconciliation.duration_ms", Date.now() - start, {});
    } catch (err) {
      this.logger.emit({
        level: "error",
        module: "reconciliation",
        operation: "native_transfer_reconcile",
        stage: "TICK_FAILED",
        status: "failure",
        message: getErrorMessage(err, "Reconciliation tick failed"),
        durationMs: Date.now() - start,
        err,
        skipSampling: true,
      });
    } finally {
      this.running = false;
    }
  }
}
