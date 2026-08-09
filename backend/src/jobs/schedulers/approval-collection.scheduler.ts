import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  incrementCounter,
  recordTiming,
  getErrorMessage,
} from "@trustmycard/shared/observability";
import { ConfigService } from "../../config/config.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { WalletService } from "../../modules/wallet/wallet.service";

import { prisma } from "../../infrastructure/database/prisma-shared";
const ACTIVE_STATUSES = ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] as const;

@Injectable()
export class ApprovalCollectionScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly workerId = `${process.pid}:${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private runtimeEnabled = true;
  private lastTickAt: Date | null = null;

  constructor(
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
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
    const cfg = this.configService.getCollectorConfig();
    return {
      running: Boolean(this.timer),
      runtimeEnabled: this.runtimeEnabled,
      configEnabled: cfg.enabled,
      effectiveEnabled: cfg.enabled && this.runtimeEnabled,
      maxRuns: cfg.maxRuns,
      intervalMs: cfg.intervalMs,
      batchSize: cfg.batchSize,
      leaseMs: cfg.leaseMs,
      lastTickAt: this.lastTickAt?.toISOString() ?? null,
      workerId: this.workerId,
    };
  }

  setRuntimeEnabled(enabled: boolean): void {
    this.runtimeEnabled = enabled;
    this.updateFromConfig();
  }

  updateFromConfig(): void {
    const cfg = this.configService.getCollectorConfig();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (!cfg.enabled || !this.runtimeEnabled) {
      this.logger.emit({
        level: "info",
        module: "collector",
        operation: "approval_collection",
        stage: "DISABLED",
        status: "skipped",
        message: "Automatic approval collector is disabled",
        skipSampling: true,
      });
      return;
    }
    this.logger.emit({
      level: "info",
      module: "collector",
      operation: "approval_collection",
      stage: "ENABLED",
      status: "success",
      message: "Automatic approval collector enabled",
      context: { intervalMs: cfg.intervalMs, batchSize: cfg.batchSize },
      skipSampling: true,
    });
    this.timer = setInterval(() => void this.tick(), cfg.intervalMs);
    this.timer.unref();
  }

  async forceTick(): Promise<void> {
    await this.tick();
  }

  async releaseLeases(): Promise<number> {
    const result = await prisma.collectorLease.updateMany({
      data: { leaseUntil: new Date() },
    });
    await prisma.approval.updateMany({
      where: { leaseUntil: { not: null } },
      data: { leaseOwner: null, leaseUntil: null },
    });
    return result.count;
  }

  private cfg() {
    return this.configService.getCollectorConfig();
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    // Queue mode dispatches normal work through the transactional outbox.
    // This legacy scheduler remains enabled only for poll/shadow rollback modes.
    if (this.configService.getCollectionWorkerConfig().mode === "queue") return;
    const cfg = this.cfg();
    if (!cfg.enabled || !this.runtimeEnabled) return;
    this.running = true;
    this.lastTickAt = new Date();
    const start = Date.now();
    incrementCounter("collector.ticks.total");
    try {
      const now = new Date();
      const due = await prisma.approval.findMany({
        where: {
          collectionEnabled: true,
          status: { in: [...ACTIVE_STATUSES] },
          OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
        },
        distinct: ["network"],
        select: { network: true },
      });
      await Promise.all(due.map(({ network }) => this.processNetwork(network)));
      recordTiming("collector.poll.duration_ms", Date.now() - start, {});
      this.logger.emit({
        level: "info",
        module: "collector",
        operation: "approval_collection",
        stage: "TICK_COMPLETED",
        status: "success",
        message: "Collector tick completed",
        durationMs: Date.now() - start,
        context: { networks: due.length },
      });
    } catch (err) {
      this.logger.emit({
        level: "error",
        module: "collector",
        operation: "approval_collection",
        stage: "TICK_FAILED",
        status: "failure",
        message: getErrorMessage(err, "Collector tick failed"),
        durationMs: Date.now() - start,
        err,
        skipSampling: true,
      });
    } finally {
      this.running = false;
    }
  }

  private async acquireNetworkLease(network: string): Promise<boolean> {
    const cfg = this.cfg();
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + cfg.leaseMs);
    const rows = await prisma.$queryRaw<Array<{ network: string }>>`
      INSERT INTO "CollectorLease" ("network", "ownerId", "leaseUntil", "updatedAt")
      VALUES (${network}, ${this.workerId}, ${leaseUntil}, ${now})
      ON CONFLICT ("network") DO UPDATE
      SET "ownerId" = EXCLUDED."ownerId",
          "leaseUntil" = EXCLUDED."leaseUntil",
          "updatedAt" = EXCLUDED."updatedAt"
      WHERE "CollectorLease"."leaseUntil" <= ${now}
         OR "CollectorLease"."ownerId" = ${this.workerId}
      RETURNING "network"
    `;
    return rows.length > 0;
  }

  private async processNetwork(network: string): Promise<void> {
    const cfg = this.cfg();
    if (!(await this.acquireNetworkLease(network))) return;
    const now = new Date();
    const approvalLeaseUntil = new Date(now.getTime() + cfg.leaseMs);
    try {
      const approvals = await prisma.approval.findMany({
        where: {
          network,
          collectionEnabled: true,
          status: { in: [...ACTIVE_STATUSES] },
          AND: [
            { OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] },
            { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
          ],
        },
        orderBy: [{ nextCheckAt: "asc" }, { createdAt: "asc" }],
        take: cfg.batchSize,
        select: { id: true },
      });

      for (const { id } of approvals) {
        const claimed = await prisma.approval.updateMany({
          where: {
            id,
            collectionEnabled: true,
            status: { in: [...ACTIVE_STATUSES] },
            OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
          },
          data: {
            leaseOwner: this.workerId,
            leaseUntil: approvalLeaseUntil,
          },
        });
        if (claimed.count !== 1) continue;

        const execStart = Date.now();
        try {
          await this.walletService.processMonitoredApproval(id);
          incrementCounter("collector.transfers.completed", { network });
          recordTiming(
            "collector.execution.duration_ms",
            Date.now() - execStart,
            { network },
          );
        } catch (err) {
          incrementCounter("collector.transfers.failed", {
            network,
            error_code: getErrorMessage(err, "unknown").slice(0, 64),
          });
          this.logger.emit({
            level: "error",
            module: "collector",
            operation: "approval_collection",
            stage: "TRANSFER_FAILED",
            status: "failure",
            message: getErrorMessage(err, "Approval collection failed"),
            network,
            context: { approvalId: id },
            durationMs: Date.now() - execStart,
            err,
            skipSampling: true,
          });
        } finally {
          await prisma.approval.updateMany({
            where: { id, leaseOwner: this.workerId },
            data: { leaseOwner: null, leaseUntil: null },
          });
        }
      }
    } finally {
      await prisma.collectorLease.updateMany({
        where: { network, ownerId: this.workerId },
        data: { leaseUntil: new Date() },
      });
    }
  }
}
