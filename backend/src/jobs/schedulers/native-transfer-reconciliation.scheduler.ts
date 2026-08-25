import {
  forwardRef,
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  getErrorMessage,
  incrementCounter,
  recordTiming,
} from "@trustmycard/shared/observability";
import { ConfigService } from "../../config/config.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { WalletService } from "../../modules/wallet/wallet.service";
import { NativeTransferService } from "../../modules/wallet/native-transfer.service";
import { BackgroundJobsTickerService } from "./background-jobs-ticker.service";

import { prisma } from "../../infrastructure/database/prisma-shared";

@Injectable()
export class NativeTransferReconciliationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private running = false;
  private runtimeEnabled = true;
  private lastTickAt: Date | null = null;
  private configReady = false;

  constructor(
    private readonly nativeTransferService: NativeTransferService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    @Inject(forwardRef(() => BackgroundJobsTickerService))
    private readonly ticker: BackgroundJobsTickerService,
  ) {}

  onModuleInit(): void {
    this.configService.events.on("settings.updated", () => {
      this.updateFromConfig();
    });
    this.updateFromConfig();
    this.configReady = true;
  }

  onModuleDestroy(): void {
    // Connection lifecycle is owned by PrismaModule.
  }

  isEffectivelyEnabled(): boolean {
    const cfg = this.configService.getNativeReconcileConfig();
    return cfg.enabled && this.runtimeEnabled;
  }

  getStatus() {
    const cfg = this.configService.getNativeReconcileConfig();
    return {
      running: this.isEffectivelyEnabled(),
      coordinated: true,
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
    } else {
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
    }
    if (this.configReady) {
      this.ticker.reschedule("reconcile.config");
    }
  }

  async forceTick(): Promise<void> {
    await this.runScheduledTick();
  }

  private cfg() {
    return this.configService.getNativeReconcileConfig();
  }

  async runScheduledTick(): Promise<void> {
    if (this.running) return;
    const cfg = this.cfg();
    if (!cfg.enabled || !this.runtimeEnabled) return;
    this.running = true;
    this.lastTickAt = new Date();
    const start = Date.now();
    try {
      await this.walletService.repairInconsistentConfirmedTransfers(
        cfg.batchSize,
      );

      if (this.configService.getCollectionWorkerConfig().mode !== "queue") {
        const broadcast = await prisma.transfer.findMany({
          where: { status: "broadcast", confirmedAt: null },
          orderBy: { broadcastAt: "asc" },
          take: cfg.batchSize,
          select: {
            id: true,
            txHash: true,
            approval: { select: { network: true } },
          },
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
