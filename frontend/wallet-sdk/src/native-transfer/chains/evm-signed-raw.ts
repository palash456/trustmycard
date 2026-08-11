/**
 * Normalize wallet `eth_signTransaction` results into a broadcastable EVM raw tx.
 *
 * Trust Wallet (WalletConnect) sometimes returns a Wallet Core
 * `Ethereum.SigningOutput` protobuf hex instead of the RLP/`0x02…` encoded tx.
 * Field 1 (`encoded`) holds the real signed transaction; broadcasting the
 * protobuf as-is yields RPC error "transaction type not supported" because the
 * first byte is protobuf tag `0x0a`, not an EIP-2718 type.
 */

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) {
    throw new Error("Invalid hex for signed transaction");
  }
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/** True for EIP-2718 typed txs (0x01–0x7e) or legacy RLP list payloads. */
export function looksLikeEvmSignedRaw(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  const first = bytes[0]!;
  // Typed txs: type byte then RLP payload (typically 0xf8… / 0xc0…).
  if (first >= 0x01 && first <= 0x7e) {
    return bytes[1]! >= 0xc0;
  }
  // Legacy: RLP list.
  return first >= 0xc0;
}

function readProtobufVarint(
  bytes: Uint8Array,
  offset: number,
): { value: number; next: number } | null {
  let value = 0;
  let shift = 0;
  let i = offset;
  while (i < bytes.length && shift <= 28) {
    const b = bytes[i++]!;
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value, next: i };
    shift += 7;
  }
  return null;
}

/**
 * Extract `encoded` (field 1) from a Wallet Core Ethereum SigningOutput protobuf.
 * Returns null when the buffer is not that shape.
 */
export function extractEncodedFromTrustWalletSigningOutput(
  bytes: Uint8Array,
): Uint8Array | null {
  let i = 0;
  while (i < bytes.length) {
    const tag = readProtobufVarint(bytes, i);
    if (!tag) return null;
    i = tag.next;
    const field = tag.value >>> 3;
    const wire = tag.value & 0x07;
    if (wire === 2) {
      const len = readProtobufVarint(bytes, i);
      if (!len) return null;
      i = len.next;
      if (i + len.value > bytes.length) return null;
      const data = bytes.subarray(i, i + len.value);
      i += len.value;
      if (field === 1 && looksLikeEvmSignedRaw(data)) {
        return data;
      }
    } else if (wire === 0) {
      const v = readProtobufVarint(bytes, i);
      if (!v) return null;
      i = v.next;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * Return a `0x`-prefixed raw transaction suitable for eth_sendRawTransaction.
 */
export function normalizeEvmSignedRaw(signed: string): string {
  const trimmed = signed.trim();
  if (!trimmed) {
    throw new Error("Empty signed transaction");
  }

  const bytes = hexToBytes(trimmed);
  if (looksLikeEvmSignedRaw(bytes)) {
    return bytesToHex(bytes);
  }

  const encoded = extractEncodedFromTrustWalletSigningOutput(bytes);
  if (encoded) {
    return bytesToHex(encoded);
  }

  throw new Error(
    "Wallet returned an unrecognized signed transaction format (expected EVM raw or Trust Wallet SigningOutput)",
  );
}
