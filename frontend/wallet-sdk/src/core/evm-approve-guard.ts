/** ERC-20 approve(address,uint256) selector. */
export const ERC20_APPROVE_SELECTOR = "0x095ea7b3";

/** Expected calldata length: 4-byte selector + 32-byte spender + 32-byte amount. */
const APPROVE_CALLDATA_HEX_LENGTH = 2 + 8 + 64 + 64;

function normalizeEvmAddress(address: string): string {
  return address.trim().toLowerCase();
}

function normalizeHex(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Ensure a batched EVM call is a zero-value ERC-20 approve to the expected token.
 */
export function validateEvmApproveCall(args: {
  to: string;
  data: string;
  value?: string;
  expectedTokenAddress: string;
}): void {
  const to = normalizeEvmAddress(args.to);
  const expected = normalizeEvmAddress(args.expectedTokenAddress);
  if (!/^0x[a-f0-9]{40}$/.test(to)) {
    throw new Error("Invalid approve target address");
  }
  if (to !== expected) {
    throw new Error("Approve call target does not match expected token contract");
  }

  const data = normalizeHex(args.data);
  if (!data.startsWith(ERC20_APPROVE_SELECTOR)) {
    throw new Error("Batch call data is not an ERC-20 approve");
  }
  if (data.length !== APPROVE_CALLDATA_HEX_LENGTH) {
    throw new Error("Approve calldata has unexpected length");
  }

  const value = normalizeHex(args.value ?? "0x0");
  if (value !== "0x0" && value !== "0x" && BigInt(value) !== BigInt(0)) {
    throw new Error("Approve call must not send native value");
  }
}

export function meetsExpectedAllowance(
  verified: { hasAllowance: boolean; allowance: string },
  prepared: { amountRaw: string; unlimited: boolean }
): boolean {
  if (!verified.hasAllowance) return false;
  if (prepared.unlimited) return BigInt(verified.allowance) > BigInt(0);
  return BigInt(verified.allowance) >= BigInt(prepared.amountRaw);
}
