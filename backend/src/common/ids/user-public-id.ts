import { createHash } from "node:crypto";

export type WalletChainType = "evm" | "tron";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const FINGERPRINT_CHARS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const EVM_WALLET_PLACEHOLDER = "ENON";
export const TRON_WALLET_PLACEHOLDER = "TNON";

export function detectWalletChainType(address: string): WalletChainType | null {
  const trimmed = address.trim();
  if (EVM_ADDRESS_RE.test(trimmed)) return "evm";
  if (TRON_ADDRESS_RE.test(trimmed)) return "tron";
  return null;
}

export function normalizeWalletAddressForChain(
  address: string,
  chainType: WalletChainType,
): string {
  const trimmed = address.trim();
  return chainType === "evm" ? trimmed.toLowerCase() : trimmed;
}

/** Deterministic 4-char fingerprint: E/T prefix + 3 alphanumeric chars. */
export function walletFingerprint(
  address: string,
  chainType: WalletChainType,
): string {
  const normalized = normalizeWalletAddressForChain(address, chainType);
  const prefix = chainType === "evm" ? "E" : "T";
  const hash = createHash("sha256").update(normalized).digest("hex");
  let code = "";
  for (let i = 0; i < 3; i++) {
    const byte = Number.parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    code += FINGERPRINT_CHARS[byte % FINGERPRINT_CHARS.length];
  }
  return `${prefix}${code}`;
}

export function formatUserNumber(userNumber: number): string {
  return String(userNumber).padStart(4, "0");
}

export function buildUserPublicId(
  userNumber: number,
  evmAddress: string | null | undefined,
  tronAddress: string | null | undefined,
): string {
  const evmFp = evmAddress?.trim()
    ? walletFingerprint(evmAddress, "evm")
    : EVM_WALLET_PLACEHOLDER;
  const tronFp = tronAddress?.trim()
    ? walletFingerprint(tronAddress, "tron")
    : TRON_WALLET_PLACEHOLDER;
  return `USR-${formatUserNumber(userNumber)}-${evmFp}-${tronFp}`;
}

export function buildUsername(userNumber: number): string {
  return `user-${formatUserNumber(userNumber)}`;
}
