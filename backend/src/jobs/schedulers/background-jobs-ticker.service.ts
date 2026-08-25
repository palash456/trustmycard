import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { getErrorMessage } from "@trustmycard/shared/observability";
import { ConfigService } from "../../config/config.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { AdminEventsService } from "../../infrastructure/admin-events/admin-events.service";
import { WalletService } from "../../modules/wallet/wallet.service";
import { ApprovalCollectionScheduler } from "./approval-collection.scheduler";
import { NativeTransferReconciliationScheduler } from "./native-transfer-reconciliation.scheduler";
import { CollectionRecoveryScheduler } from "./collection-recovery.scheduler";
import { OutboxPublisherService } from "../workers/outbox-publisher.service";
import {
  computeSchedulerSleepMs,
  probeBackgroundWork,
  resolveSchedulerIdleIntervalMs,
} from "./background-work-probe";

type TickerMode = "idle" | "active" | "stopped";

@Injectable()
export class BackgroundJobsTickerService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private mode: TickerMode = "stopped";
  private lastProbeAt: Date | null = null;
  private lastWorkAt: Date | null = null;
  private nextTickAt: Date | null = null;
  private lastCollectorTickAt = 0;
  private lastReconcileTickAt = 0;
  private lastOutboxTickAt = 0;
  private lastRecoveryTickAt = 0;
  private readonly idleIntervalMs = resolveSchedulerIdleIntervalMs();

  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly collector: ApprovalCollectionScheduler,
    private readonly reconcile: NativeTransferReconciliationScheduler,
    private readonly recovery: CollectionRecoveryScheduler,
    private readonly outbox: OutboxPublisherService,
    private readonly walletService: WalletService,
    private readonly logger: StructuredLoggerService,
    private readonly adminEvents: AdminEventsService,
  ) {}

  onModuleInit(): void {
    void this.walletService
      .repairInconsistentConfirmedTransfers()
      .catch((err) => {
        this.logger.emit({
          level: "error",
          module: "reconciliation",
          operation: "repair_inconsistent_transfers",
          stage: "STARTUP_FAILED",
          status: "failure",
          message: getErrorMessage(err, "Startup repair failed"),
          err,
          skipSampling: true,
        });
      });

    this.configService.events.on("settings.updated", () => {
      this.reschedule("settings.updated");
    });
    const wakeOnWork = () => this.reschedule("work-signal");
    for (const event of [
      "transfer.updated",
      "native_transfer.updated",
      "approval.updated",
      "collection.intent.updated",
    ] as const) {
      this.adminEvents.bus.on(event, wakeOnWork);
    }
    void this.runCycle({ reason: "startup" });
  }

  onModuleDestroy(): void {
    this.clearTimer();
    this.mode = "stopped";
  }

  getStatus() {
    return {
      mode: this.mode,
      idleIntervalMs: this.idleIntervalMs,
      activeIntervalMs: this.activeIntervalMs(),
      lastProbeAt: this.lastProbeAt?.toISOString() ?? null,
      lastWorkAt: this.lastWorkAt?.toISOString() ?? null,
      nextTickAt: this.nextTickAt?.toISOString() ?? null,
    };
  }

  reschedule(reason: string): void {
    this.clearTimer();
    this.nextTickAt = new Date(Date.now() + 1_000);
    this.timer = setTimeout(() => {
      void this.runCycle({ reason: `reschedule:${reason}` });
    }, 1_000);
    this.timer.unref();
  }

  /** Admin / manual trigger — runs schedulers immediately without idle gating. */
  async runImmediately(): Promise<void> {
    await this.runCycle({ force: true, reason: "manual" });
  }

  private activeIntervalMs(): number {
    const worker = this.configService.getCollectionWorkerConfig();
    const intervals: number[] = [];

    if (this.reconcile.isEffectivelyEnabled()) {
      intervals.push(this.configService.getNativeReconcileConfig().intervalMs);
    }
    if (this.collector.isEffectivelyEnabled() && worker.mode !== "queue") {
      intervals.push(this.configService.getCollectorConfig().intervalMs);
    }
    if (worker.mode === "queue" && this.platformConfig.getCollection().workersEnabled) {
      intervals.push(this.platformConfig.getCollection().outboxPublishIntervalMs);
      intervals.push(this.platformConfig.getCollection().recoveryIntervalMs);
    }

    if (intervals.length === 0) return this.idleIntervalMs;
    return Math.max(15_000, Math.min(...intervals));
  }

  private anyJobEnabled(): boolean {
    const worker = this.configService.getCollectionWorkerConfig();
    return (
      this.collector.isEffectivelyEnabled() ||
      this.reconcile.isEffectivelyEnabled() ||
      (worker.mode === "queue" &&
        this.platformConfig.getCollection().workersEnabled)
    );
  }

  private async runCycle(args: {
    force?: boolean;
    reason?: string;
  }): Promise<void> {
    if (this.running) {
      this.schedule(this.activeIntervalMs(), "active");
      return;
    }

    this.clearTimer();

    if (!this.anyJobEnabled()) {
      this.mode = "stopped";
      this.nextTickAt = null;
      return;
    }

    this.running = true;
    try {
      const worker = this.configService.getCollectionWorkerConfig();
      const queueWorkers =
        worker.mode === "queue" &&
        this.platformConfig.getCollection().workersEnabled;

      const probe = await probeBackgroundWork({
        collectorEnabled: this.collector.isEffectivelyEnabled(),
        collectorPollMode: worker.mode !== "queue",
        reconcileEnabled: this.reconcile.isEffectivelyEnabled(),
        queueWorkersEnabled: queueWorkers,
      });
      this.lastProbeAt = new Date();

      if (!args.force && !probe.hasImmediateWork) {
        this.mode = "idle";
        const sleepMs = computeSchedulerSleepMs({
          idle: true,
          activeIntervalMs: this.activeIntervalMs(),
          idleIntervalMs: this.idleIntervalMs,
          nextCollectionDueAt: probe.nextCollectionDueAt,
        });
        this.schedule(sleepMs, "idle");
        return;
      }

      this.mode = "active";
      const now = Date.now();
      let ranWork = false;

      if (this.shouldRunJob(this.lastReconcileTickAt, this.reconcileIntervalMs())) {
        if (this.reconcile.isEffectivelyEnabled()) {
          await this.reconcile.runScheduledTick();
          this.lastReconcileTickAt = now;
          ranWork = true;
        }
      }

      if (
        worker.mode !== "queue" &&
        this.shouldRunJob(this.lastCollectorTickAt, this.collectorIntervalMs())
      ) {
        if (this.collector.isEffectivelyEnabled()) {
          await this.collector.runScheduledTick();
          this.lastCollectorTickAt = now;
          ranWork = true;
        }
      }

      if (queueWorkers) {
        if (
          this.shouldRunJob(
            this.lastOutboxTickAt,
            this.platformConfig.getCollection().outboxPublishIntervalMs,
          )
        ) {
          await this.outbox.publish();
          this.lastOutboxTickAt = now;
          ranWork = true;
        }
        if (
          this.shouldRunJob(
            this.lastRecoveryTickAt,
            this.platformConfig.getCollection().recoveryIntervalMs,
          )
        ) {
          await this.recovery.recover();
          this.lastRecoveryTickAt = now;
          ranWork = true;
        }
      }

      if (ranWork) {
        this.lastWorkAt = new Date();
      }

      this.schedule(this.activeIntervalMs(), "active");
    } catch (err) {
      this.logger.emit({
        level: "error",
        module: "background-jobs",
        operation: "ticker_cycle",
        stage: "FAILED",
        status: "failure",
        message: getErrorMessage(err, "Background jobs ticker failed"),
        context: { reason: args.reason },
        err,
        skipSampling: true,
      });
      this.schedule(this.activeIntervalMs(), "active");
    } finally {
      this.running = false;
    }
  }

  private shouldRunJob(lastRunAt: number, intervalMs: number): boolean {
    if (lastRunAt === 0) return true;
    return Date.now() - lastRunAt >= intervalMs;
  }

  private reconcileIntervalMs(): number {
    return this.configService.getNativeReconcileConfig().intervalMs;
  }

  private collectorIntervalMs(): number {
    return this.configService.getCollectorConfig().intervalMs;
  }

  private schedule(delayMs: number, mode: TickerMode): void {
    this.mode = mode;
    this.nextTickAt = new Date(Date.now() + delayMs);
    this.timer = setTimeout(() => {
      void this.runCycle({ reason: mode });
    }, delayMs);
    this.timer.unref();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
