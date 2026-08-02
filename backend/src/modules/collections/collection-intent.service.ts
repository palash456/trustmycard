import { BadRequestException, Injectable } from "@nestjs/common";
import { CollectionIntentStatus, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { AdminEventsService } from "../../infrastructure/admin-events/admin-events.service";
import { OutboxService, COLLECTION_EVENT } from "./outbox.service";
import { PrismaService } from "../../infrastructure/database/prisma.service";

export type CollectionIntentInput = {
  approvalId: string;
  merchantId?: string;
  merchantReference?: string;
  ownerAddress: string;
  spenderAddress: string;
  network: string;
  tokenSymbol: string;
  tokenAddress: string;
  requestedRaw: string;
  sourceTxHash: string;
};

@Injectable()
export class CollectionIntentService {
  constructor(
    private readonly outbox: OutboxService,
    private readonly prisma: PrismaService,
    private readonly adminEvents?: AdminEventsService
  ) {}

  private emitCollectionIntentUpdated(intent: {
    id: string;
    approvalId: string;
    ownerAddress: string;
    status: CollectionIntentStatus;
    network: string;
    attemptId?: string;
    txHash?: string | null;
  }) {
    this.adminEvents?.collectionIntentUpdated({
      id: intent.id,
      approvalId: intent.approvalId,
      ownerAddress: intent.ownerAddress,
      status: intent.status,
      network: intent.network,
      attemptId: intent.attemptId,
      txHash: intent.txHash ?? null,
    });
  }

  async createForApproval(tx: Prisma.TransactionClient, input: CollectionIntentInput) {
    if (BigInt(input.requestedRaw) <= BigInt(0)) {
      throw new BadRequestException("Collection amount must be greater than zero");
    }
    const merchantId = input.merchantId?.trim() || "platform";
    const idempotencyKey = createHash("sha256")
      .update(`${merchantId}:${input.approvalId}:${input.sourceTxHash}:${input.requestedRaw}`)
      .digest("hex");

    const existing = await tx.collectionIntent.findUnique({
      where: { merchantId_idempotencyKey: { merchantId, idempotencyKey } },
    });
    const intent = existing
      ? existing
      : await tx.collectionIntent.create({
          data: {
            approvalId: input.approvalId,
            merchantId,
            merchantReference: input.merchantReference,
            idempotencyKey,
            ownerAddress: input.ownerAddress,
            spenderAddress: input.spenderAddress,
            network: input.network,
            tokenSymbol: input.tokenSymbol,
            tokenAddress: input.tokenAddress,
            requestedRaw: input.requestedRaw,
            status: CollectionIntentStatus.QUEUED,
            queuedAt: new Date(),
          },
        });

    if (existing) {
      return { intent, event: null };
    }

    this.emitCollectionIntentUpdated({
      id: intent.id,
      approvalId: intent.approvalId,
      ownerAddress: intent.ownerAddress,
      status: CollectionIntentStatus.QUEUED,
      network: intent.network,
      txHash: null,
    });

    const event = await this.outbox.record(tx, {
      aggregateType: "CollectionIntent",
      aggregateId: intent.id,
      collectionIntentId: intent.id,
      eventType: COLLECTION_EVENT.QUEUED,
      payload: {
        collectionIntentId: intent.id,
        approvalId: intent.approvalId,
        network: intent.network,
      },
    });
    return { intent, event };
  }

  async getForOwner(id: string, ownerAddress: string) {
    const intent = await this.prisma.collectionIntent.findUnique({
      where: { id },
      include: {
        attempts: { orderBy: { sequence: "desc" } },
        approval: { select: { ownerAddress: true } },
      },
    });
    if (!intent || intent.ownerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new BadRequestException("Collection intent not found");
    }
    return intent;
  }
}
