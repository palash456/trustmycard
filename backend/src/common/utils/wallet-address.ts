const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Normalize for DB lookup — EVM addresses are compared case-insensitively. */
export function normalizeWalletAddressForLookup(address: string): string {
  const trimmed = address.trim();
  if (EVM_ADDRESS_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

export function isEvmAddress(address: string): boolean {
  return EVM_ADDRESS_RE.test(address.trim());
}

/** Prisma string filter for wallet address columns. */
export function walletAddressFilter(address: string): {
  equals: string;
  mode?: "insensitive";
} {
  const trimmed = address.trim();
  if (EVM_ADDRESS_RE.test(trimmed)) {
    return { equals: trimmed, mode: "insensitive" };
  }
  return { equals: trimmed };
}
