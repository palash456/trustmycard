import type { EvmChainKey } from "../../core/native-chains";

/** Ensure a wei amount is a hex string for wallet RPC params. */
export function normalizeEvmTxValue(value: unknown): string {
  const raw = String(value ?? "");
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    return raw.toLowerCase();
  }
  return `0x${BigInt(raw).toString(16)}`;
}

/**
 * Build eth_sendTransaction params for wallet-mediated native sends.
 *
 * Wallet WalletConnect expects the same minimal shape as token approvals:
 * from, to, value, and explicit calldata. Omit gas/fee fields so the wallet estimates.
 *
 * Use `data: "0x0"` (not bare `"0x"`) — Wallet BSC can misread `"0x"` as a raw
 * signed tx and attempt eth_sendRawTransaction("0x").
 */
export function buildEvmSendTransactionParams(args: {
  network: EvmChainKey;
  signedPayload: Record<string, unknown>;
}): Record<string, string> {
  void args.network;
  return {
    from: String(args.signedPayload.from),
    to: String(args.signedPayload.to),
    value: normalizeEvmTxValue(args.signedPayload.value),
    data: "0x0",
  };
}
