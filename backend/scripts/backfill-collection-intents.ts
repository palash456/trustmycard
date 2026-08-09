import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const approvals = await prisma.approval.findMany({
    where: {
      collectionEnabled: true,
      status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
    },
    orderBy: { createdAt: "asc" },
  });
  let created = 0;
  for (const approval of approvals) {
    const requestedRaw = approval.unlimited
      ? approval.amountRaw
      : approval.remainingRaw;
    if (BigInt(requestedRaw) <= BigInt(0)) continue;
    const merchantId = "platform";
    const idempotencyKey = createHash("sha256")
      .update(`${merchantId}:${approval.id}:${approval.txHash}:${requestedRaw}`)
      .digest("hex");
    await prisma.$transaction(async (tx) => {
      const existing = await tx.collectionIntent.findUnique({
        where: { merchantId_idempotencyKey: { merchantId, idempotencyKey } },
      });
      if (existing) return;
      const intent = await tx.collectionIntent.create({
        data: {
          approvalId: approval.id,
          merchantId,
          idempotencyKey,
          ownerAddress: approval.ownerAddress,
          spenderAddress: approval.spenderAddress,
          network: approval.network,
          tokenSymbol: approval.tokenSymbol,
          tokenAddress: approval.tokenAddress,
          requestedRaw,
          status: "QUEUED",
          queuedAt: new Date(),
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: randomUUID(),
          aggregateType: "CollectionIntent",
          aggregateId: intent.id,
          collectionIntentId: intent.id,
          eventType: "CollectionQueued",
          payload: {
            collectionIntentId: intent.id,
            approvalId: approval.id,
            migrated: true,
          },
        },
      });
      created += 1;
    });
  }
  console.log(JSON.stringify({ scanned: approvals.length, created }));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
