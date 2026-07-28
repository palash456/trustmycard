import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { NativeTransferService } from "../../modules/wallet/native-transfer.service";

const prisma = new PrismaClient();

@Injectable()
export class NativeTransferReconciliationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NativeTransferReconciliationScheduler.name);
  private readonly enabled =
    (process.env.NATIVE_RECONCILE_ENABLED ?? "true").toLowerCase() !== "false";
  private readonly intervalMs = Math.max(
    15_000,
    Number(process.env.NATIVE_RECONCILE_INTERVAL_MS ?? 60_000)
  );
  private readonly batchSize = Math.max(
    1,
    Math.min(50, Number(process.env.NATIVE_RECONCILE_BATCH_SIZE ?? 10))
  );
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly nativeTransferService: NativeTransferService) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log("Native transfer reconciliation is disabled");
      return;
    }
    this.logger.log(
      `Native transfer reconciliation enabled (interval=${this.intervalMs}ms, batch=${this.batchSize})`
    );
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
    setTimeout(() => void this.tick(), 8_000).unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await prisma.$disconnect();
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await prisma.nativeTransfer.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: this.batchSize,
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
