import type { Prisma } from "@prisma/client";
import {
  generatePublicId,
  isFlowId,
  networkQualifier,
  tokenQualifier,
  type PublicIdKind,
} from "@trustmycard/shared/ids";
import { addressesEqual } from "@trustmycard/shared/constants/self-spender";

type PublicIdModel =
  | "approval"
  | "transfer"
  | "collectionIntent"
  | "nativeTransfer"
  | "networkSettlementSession";

const MODEL_KIND: Record<PublicIdModel, PublicIdKind> = {
  approval: "approval",
  transfer: "transfer",
  collectionIntent: "collect",
  nativeTransfer: "transfer-native",
  networkSettlementSession: "settlement",
};

export function normalizeJourneyId(
  raw: string | null | undefined
): string | null {
  const id = raw?.trim();
  if (!id || id === "n/a") return null;
  return id;
}

/** Reject journey IDs already bound to a different wallet address. */
export async function assertJourneyWalletMatch(
  tx: Prisma.TransactionClient,
  journeyId: string,
  walletAddress: string
): Promise<void> {
  if (!isFlowId(journeyId)) return;

  const approval = await tx.approval.findFirst({
    where: { traceId: journeyId },
    select: { ownerAddress: true },
  });
  if (approval && !addressesEqual(approval.ownerAddress, walletAddress)) {
    throw new Error(`Journey ID ${journeyId} belongs to a different wallet`);
  }

  const settlement = await tx.networkSettlementSession.findFirst({
    where: {
      OR: [{ clientSessionId: journeyId }, { traceId: journeyId }],
    },
    select: { ownerAddress: true },
  });
  if (settlement && !addressesEqual(settlement.ownerAddress, walletAddress)) {
    throw new Error(`Journey ID ${journeyId} belongs to a different wallet`);
  }
}

export async function allocatePublicId(
  tx: Prisma.TransactionClient,
  model: PublicIdModel,
  qualifier: string,
  journeyId: string | null | undefined
): Promise<string | undefined> {
  const journey = normalizeJourneyId(journeyId);
  if (!journey) return undefined;

  const kind = MODEL_KIND[model];
  const prefix = generatePublicId(kind, qualifier, journey);

  const count = await (tx[model] as { count: (args: object) => Promise<number> }).count({
    where: {
      publicId: { startsWith: prefix },
    },
  });

  const sequence = count + 1;
  return generatePublicId(
    kind,
    qualifier,
    journey,
    sequence > 1 ? sequence : undefined
  );
}

export { tokenQualifier, networkQualifier };

export async function journeyWriteFields(
  tx: Prisma.TransactionClient,
  model: PublicIdModel,
  qualifier: string,
  journeyId: string | null | undefined,
  walletAddress: string
): Promise<{ traceId?: string; publicId?: string }> {
  const journey = normalizeJourneyId(journeyId);
  if (!journey) return {};
  await assertJourneyWalletMatch(tx, journey, walletAddress);
  const publicId = await allocatePublicId(tx, model, qualifier, journey);
  return {
    traceId: journey,
    ...(publicId ? { publicId } : {}),
  };
}
