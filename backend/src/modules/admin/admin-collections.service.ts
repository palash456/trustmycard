import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { isCollectionSigningEnabled } from "../../config/service-role";
import { AdminEventsService } from "../../infrastructure/admin-events/admin-events.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { ConfigService } from "../../config/config.service";
import { CollectionQueueService } from "../../jobs/queues/collection-queue.service";
import { OutboxPublisherService } from "../../jobs/workers/outbox-publisher.service";
import { COLLECTION_EVENT, OutboxService } from "../collections/outbox.service";
import { WalletService } from "../wallet/wallet.service";

@Injectable()
export class AdminCollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: CollectionQueueService,
    private readonly publisher: OutboxPublisherService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly wallet: WalletService,
    private readonly adminEvents: AdminEventsService
  ) {}

  async status() {
    const [queues, intents, outbox] = await Promise.all([
      this.queues.stats(),
      this.prisma.collectionIntent.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.outboxEvent.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return {
      queues,
      intents: Object.fromEntries(intents.map((row) => [row.status, row._count._all])),
      outbox: Object.fromEntries(outbox.map((row) => [row.status, row._count._all])),
    };
  }

  async listIntents(status?: string) {
    return this.prisma.collectionIntent.findMany({
      where: status ? { status: status as never } : undefined,
      include: { attempts: { orderBy: { sequence: "desc" }, take: 5 }, approval: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async retryIntent(id: string) {
    const intent = await this.prisma.collectionIntent.findUnique({ where: { id } });
    if (!intent) throw new NotFoundException("Collection intent not found");
    await this.prisma.collectionIntent.update({
      where: { id },
      data: { status: "QUEUED", lastErrorCode: null, lastErrorMessage: null, queuedAt: new Date() },
    });
    this.adminEvents.collectionIntentUpdated({
      id,
      approvalId: intent.approvalId,
      ownerAddress: intent.ownerAddress,
      status: "QUEUED",
      network: intent.network,
      txHash: null,
    });
    await this.queues.enqueueExecution({ intentId: id, outboxEventId: `admin-retry:${id}:${Date.now()}` });
    return { ok: true, id };
  }

  async recoverOutbox() {
    return { ok: true, published: await this.publisher.publish() };
  }

  async deadLetters() {
    return this.queues.listDeadLetters();
  }

  async adminTransfer(body: Record<string, unknown>) {
    const mode = this.config.getCollectionWorkerConfig().mode;
    if (mode === "poll") {
      if (isCollectionSigningEnabled()) {
        return this.wallet.adminTransfer(body);
      }
      throw new BadRequestException(
        "Poll-mode admin transfer requires collection signing on this process; set COLLECTION_DISPATCH_MODE=queue for API-only deploys"
      );
    }

    const approvalId = String(body.approvalId ?? "").trim();
    const amountRaw = String(body.amountRaw ?? "").trim();
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();
    if (!approvalId || !amountRaw || !idempotencyKey) {
      throw new BadRequestException("approvalId, amountRaw, and idempotencyKey are required");
    }
    const approval = await this.prisma.approval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException("Approval not found");

    const merchantId = "admin";
    const key = createHash("sha256")
      .update(`${merchantId}:${approvalId}:${idempotencyKey}:${amountRaw}`)
      .digest("hex");
    const { intent } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.collectionIntent.findUnique({
        where: { merchantId_idempotencyKey: { merchantId, idempotencyKey: key } },
      });
      if (existing) return { intent: existing };
      const created = await tx.collectionIntent.create({
        data: {
          approvalId,
          merchantId,
          idempotencyKey: key,
          ownerAddress: approval.ownerAddress,
          spenderAddress: String(body.toAddress ?? approval.spenderAddress).trim() || approval.spenderAddress,
          network: approval.network,
          tokenSymbol: approval.tokenSymbol,
          tokenAddress: approval.tokenAddress,
          requestedRaw: amountRaw,
          status: "QUEUED",
          queuedAt: new Date(),
        },
      });
      await this.outbox.record(tx, {
        aggregateType: "CollectionIntent",
        aggregateId: created.id,
        collectionIntentId: created.id,
        eventType: COLLECTION_EVENT.QUEUED,
        payload: { collectionIntentId: created.id, approvalId, manual: true },
      });
      return { intent: created };
    });

    this.adminEvents.collectionIntentUpdated({
      id: intent.id,
      approvalId: intent.approvalId,
      ownerAddress: intent.ownerAddress,
      status: "QUEUED",
      network: intent.network,
      txHash: null,
    });

    if (mode === "queue") {
      await this.queues.enqueueExecution({
        intentId: intent.id,
        outboxEventId: `admin-manual:${intent.id}:${Date.now()}`,
      });
    } else {
      await this.publisher.publish();
    }
    return { ok: true, queued: true, collectionIntentId: intent.id, mode };
  }
}
