import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { Wallet } from "ethers";
import { TronWeb } from "tronweb";
import { safeCreateAuditLog } from "../../common/audit/safe-audit";
import { ConfigService } from "../../config/config.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { SETTING_KEYS } from "../../config/settings-keys";
import { ApprovalCollectionScheduler } from "../../jobs/schedulers/approval-collection.scheduler";
import { NativeTransferReconciliationScheduler } from "../../jobs/schedulers/native-transfer-reconciliation.scheduler";
import { BackgroundJobsTickerService } from "../../jobs/schedulers/background-jobs-ticker.service";
import { AdminDevOpsService } from "./admin-devops.service";
import { AdminStreamService } from "./admin-stream.service";
import { WalletService } from "../wallet/wallet.service";

import { prisma } from "../../infrastructure/database/prisma-shared";

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly walletService: WalletService,
    private readonly collectorScheduler: ApprovalCollectionScheduler,
    private readonly nativeScheduler: NativeTransferReconciliationScheduler,
    private readonly backgroundJobsTicker: BackgroundJobsTickerService,
    private readonly streamService: AdminStreamService,
    private readonly devOpsService: AdminDevOpsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async getSettings(category?: string) {
    return {
      settings: this.configService.getAll(category),
      lastReloadAt: this.configService.getLastReloadAt()?.toISOString() ?? null,
    };
  }

  async patchSettings(body: Record<string, unknown>, actor = "admin") {
    const updates = (body.settings ?? body) as Record<string, unknown>;
    const changed = await this.configService.setMany(updates, actor);
    await this.recordAudit(actor, "settings.update", "settings", null, {
      changed,
      updates,
    });
    await this.configService.reload();
    this.collectorScheduler.updateFromConfig();
    this.nativeScheduler.updateFromConfig();
    this.streamService.emit("settings.updated", { keys: changed });
    return { ok: true, changed };
  }

  async reloadConfig() {
    await this.configService.reload();
    this.collectorScheduler.updateFromConfig();
    this.nativeScheduler.updateFromConfig();
    return {
      ok: true,
      lastReloadAt: this.configService.getLastReloadAt()?.toISOString() ?? null,
    };
  }

  async getSystemStatus() {
    const wallets = this.platformConfig.getWallets();
    const evmSpender = wallets.spenderEvm;
    const tronSpender = wallets.spenderTron;
    const evmKey = wallets.adminEvmPrivateKey;
    const tronKey = wallets.adminTronPrivateKey;

    let evmMatch = false;
    let tronMatch = false;
    try {
      if (evmKey && evmSpender) {
        evmMatch =
          new Wallet(evmKey).address.toLowerCase() === evmSpender.toLowerCase();
      }
    } catch {
      evmMatch = false;
    }
    try {
      if (tronKey && tronSpender) {
        const tron = new TronWeb({
          fullHost: this.platformConfig.getChains().tronFullHost,
          privateKey: tronKey,
        });
        const derived = tron.address.fromPrivateKey(tronKey);
        tronMatch = typeof derived === "string" && derived === tronSpender;
      }
    } catch {
      tronMatch = false;
    }

    return {
      secrets: {
        evm: {
          configured: Boolean(evmKey),
          spenderAddress: evmSpender || null,
          spenderMatch: evmMatch,
        },
        tron: {
          configured: Boolean(tronKey),
          spenderAddress: tronSpender || null,
          spenderMatch: tronMatch,
        },
      },
      platform: this.configService.getPublicPlatformConfig(),
      collector: this.collectorScheduler.getStatus(),
      nativeReconcile: this.nativeScheduler.getStatus(),
      backgroundJobs: this.backgroundJobsTicker.getStatus(),
      configLastReloadAt:
        this.configService.getLastReloadAt()?.toISOString() ?? null,
      devOpsEnabled:
        process.env.NODE_ENV !== "production" &&
        (process.env.ADMIN_DEV_OPS ?? "").toLowerCase() === "true",
    };
  }

  async patchApproval(
    id: string,
    body: Record<string, unknown>,
    actor = "admin",
  ) {
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException("Approval not found");

    const data: Record<string, unknown> = {};
    if (typeof body.collectionEnabled === "boolean") {
      data.collectionEnabled = body.collectionEnabled;
    }
    if (body.collectionToAddress !== undefined) {
      data.collectionToAddress =
        String(body.collectionToAddress ?? "").trim() || null;
    }
    if (body.remainingRaw !== undefined) {
      data.remainingRaw = String(body.remainingRaw).trim();
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("No valid fields to update");
    }

    const updated = await prisma.approval.update({
      where: { id },
      data,
    });
    await this.recordAudit(actor, "approval.update", "approval", id, {
      before: {
        collectionEnabled: approval.collectionEnabled,
        collectionToAddress: approval.collectionToAddress,
        remainingRaw: approval.remainingRaw,
        expiresAt: approval.expiresAt,
      },
      after: data,
    });
    this.streamService.emit("approval.updated", {
      id: updated.id,
      ownerAddress: updated.ownerAddress,
      status: updated.status,
      network: updated.network,
    });
    return { ok: true, item: updated };
  }

  async retryTransfer(id: string, actor = "admin") {
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { approval: true },
    });
    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.status === "broadcast") {
      const result = await this.walletService.reconcileTransfer(id);
      await this.recordAudit(
        actor,
        "transfer.reconcile",
        "approval",
        transfer.approvalId,
        {
          transferId: id,
          previousStatus: transfer.status,
        },
      );
      return result;
    }
    if (transfer.status !== "failed") {
      throw new BadRequestException(
        "Only failed or broadcast transfers can be retried",
      );
    }
    const idempotencyKey = `admin-retry:${id}:${Date.now()}`;
    const result = await this.walletService.adminTransfer({
      approvalId: transfer.approvalId,
      amountRaw: transfer.amountRaw,
      toAddress: transfer.toAddress,
      idempotencyKey,
    });
    await prisma.transfer.update({
      where: { id },
      data: { retryCount: { increment: 1 } },
    });
    await this.recordAudit(
      actor,
      "transfer.retry",
      "approval",
      transfer.approvalId,
      {
        transferId: id,
        idempotencyKey,
      },
    );
    return result;
  }

  async reconcileTransfer(id: string, actor = "admin") {
    const result = await this.walletService.reconcileTransfer(id);
    await this.recordAudit(
      actor,
      "transfer.reconcile",
      "approval",
      result.item.approvalId,
      {
        transferId: id,
        status: result.item.status,
        repaired: "repaired" in result ? result.repaired : false,
      },
    );
    return result;
  }

  async getTgEvent(id: string) {
    const item = await prisma.tgLogEvent.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Event not found");
    return { item };
  }

  async collectorToggle(body: { enabled?: boolean }, actor = "admin") {
    if (typeof body.enabled === "boolean") {
      this.collectorScheduler.setRuntimeEnabled(body.enabled);
      await this.configService.setMany(
        { [SETTING_KEYS.COLLECTOR_ENABLED]: body.enabled },
        actor,
      );
    }
    await this.recordAudit(actor, "collector.toggle", "collector", null, body);
    this.streamService.emit(
      "collector.updated",
      this.collectorScheduler.getStatus(),
    );
    return { ok: true, status: this.collectorScheduler.getStatus() };
  }

  async collectorTick() {
    await this.collectorScheduler.forceTick();
    this.streamService.emit("collector.tick", { at: new Date().toISOString() });
    return { ok: true, message: "Collector tick completed" };
  }

  async releaseLeases(actor = "admin") {
    const released = await this.collectorScheduler.releaseLeases();
    await this.recordAudit(
      actor,
      "collector.release_leases",
      "collector",
      null,
      { released },
    );
    return { ok: true, released };
  }

  restartBackend(actor = "admin") {
    const result = this.devOpsService.restartBackend();
    this.recordAudit(actor, "dev.restart_backend", "system", null, {});
    return result;
  }

  restartWebsite(actor = "admin") {
    const result = this.devOpsService.restartWebsite();
    this.recordAudit(actor, "dev.restart_website", "system", null, {});
    return result;
  }

  getWalletTimeline(address: string) {
    return prisma.auditLog.findMany({
      where: {
        OR: [
          { payload: { path: ["address"], equals: address } },
          { actor: { contains: address, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  private async recordAudit(
    actor: string,
    action: string,
    entityType: string,
    entityId: string | null,
    payload: unknown,
  ) {
    const ok = await safeCreateAuditLog(
      prisma,
      {
        actor,
        action,
        entityType,
        entityId,
        payload: payload as object,
      },
      this.logger,
    );
    if (ok) {
      this.streamService.emit("audit.created", {
        action,
        entityType,
        entityId,
      });
    }
  }
}
