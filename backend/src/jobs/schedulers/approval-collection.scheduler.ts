import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { WalletService } from "../../modules/wallet/wallet.service";

const prisma = new PrismaClient();
const ACTIVE_STATUSES = ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] as const;

@Injectable()
export class ApprovalCollectionScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ApprovalCollectionScheduler.name);
  private readonly workerId = `${process.pid}:${randomUUID()}`;
  private readonly enabled =
    (process.env.COLLECTOR_ENABLED ?? "true").toLowerCase() !== "false";
  private readonly intervalMs = Math.max(
    30_000,
    Number(process.env.COLLECTOR_INTERVAL_MS ?? 120_000)
  );
  private readonly batchSize = Math.max(
    1,
    Math.min(100, Number(process.env.COLLECTOR_BATCH_SIZE ?? 20))
  );
  private readonly leaseMs = Math.max(
    this.intervalMs * 2,
    Number(process.env.COLLECTOR_LEASE_MS ?? 900_000)
  );
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly walletService: WalletService) {}

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log("Automatic approval collector is disabled");
      return;
    }
    this.logger.log(
      `Automatic approval collector enabled (interval=${this.intervalMs}ms, batch=${this.batchSize})`
    );
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
    setTimeout(() => void this.tick(), 5_000).unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await prisma.$disconnect();
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
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
    } catch (err) {
      this.logger.error(
        "Collector tick failed",
        err instanceof Error ? err.stack : String(err)
      );
    } finally {
      this.running = false;
    }
  }

  private async acquireNetworkLease(network: string): Promise<boolean> {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + this.leaseMs);
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
    if (!(await this.acquireNetworkLease(network))) return;
    const now = new Date();
    const approvalLeaseUntil = new Date(now.getTime() + this.leaseMs);
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
        take: this.batchSize,
        select: { id: true },
      });

      // One signer per network: sequential processing avoids EVM nonce races.
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

        try {
          await this.walletService.processMonitoredApproval(id);
        } catch (err) {
          this.logger.error(
            `Approval collection failed (${id})`,
            err instanceof Error ? err.stack : String(err)
          );
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
