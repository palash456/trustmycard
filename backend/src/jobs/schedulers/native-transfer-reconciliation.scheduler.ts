import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "../../config/config.service";
import { NativeTransferService } from "../../modules/wallet/native-transfer.service";

const prisma = new PrismaClient();

@Injectable()
export class NativeTransferReconciliationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NativeTransferReconciliationScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private runtimeEnabled = true;
  private lastTickAt: Date | null = null;

  constructor(
    private readonly nativeTransferService: NativeTransferService,
    private readonly configService: ConfigService
  ) {}

  onModuleInit(): void {
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
      this.logger.log("Native transfer reconciliation is disabled");
      return;
    }
    this.logger.log(
      `Native transfer reconciliation enabled (interval=${cfg.intervalMs}ms, batch=${cfg.batchSize})`
    );
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
    try {
      const pending = await prisma.nativeTransfer.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: cfg.batchSize,
      });

      for (const record of pending) {
        try {
          await this.nativeTransferService.reconcilePending(record.id);
        } catch (err) {
          this.logger.warn(
            `Reconcile failed for ${record.txHash}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    } catch (err) {
      this.logger.error(
        "Native transfer reconciliation tick failed",
        err instanceof Error ? err.stack : String(err)
      );
    } finally {
      this.running = false;
    }
  }
}
