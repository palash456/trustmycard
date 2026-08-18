import { prisma } from "../../infrastructure/database/prisma-shared";
import {
  detectWalletChainType,
  normalizeWalletAddressForChain,
} from "../../common/ids/user-public-id";

export type UserDisplayFields = {
  userId: string;
  username: string;
  userPublicId: string;
};

export async function lookupUsersByWalletAddresses(
  addresses: Array<string | null | undefined>,
): Promise<Map<string, UserDisplayFields>> {
  const unique = [
    ...new Set(
      addresses.map((a) => a?.trim()).filter((v): v is string => Boolean(v)),
    ),
  ];
  const walletFilters = unique.flatMap((address) => {
    const chainType = detectWalletChainType(address);
    if (!chainType) return [];
    const normalized = normalizeWalletAddressForChain(address, chainType);
    return [{ address: normalized, chainType }];
  });
  if (walletFilters.length === 0) return new Map();

  const userWallets = await prisma.userWallet.findMany({
    where: { OR: walletFilters },
    include: { user: true },
  });

  const result = new Map<string, UserDisplayFields>();
  for (const row of userWallets) {
    const fields = {
      userId: row.user.id,
      username: row.user.username,
      userPublicId: row.user.publicId,
    };
    result.set(row.address, fields);
    if (row.chainType === "evm") {
      result.set(row.address.toLowerCase(), fields);
    }
  }
  return result;
}

export function resolveUserForWalletAddress(
  map: Map<string, UserDisplayFields>,
  address: string | null | undefined,
): UserDisplayFields | null {
  const trimmed = address?.trim();
  if (!trimmed) return null;
  const chainType = detectWalletChainType(trimmed);
  if (!chainType) return null;
  const normalized = normalizeWalletAddressForChain(trimmed, chainType);
  return map.get(normalized) ?? map.get(normalized.toLowerCase()) ?? null;
}
