import { getAllowancePolicy } from "@/lib/approve-config";
import { MAX_UINT256, parseHumanToRaw } from "@/lib/chain-tokens";

function pad32(hexOrAddr: string): string {
  const h = hexOrAddr.replace(/^0x/i, "").toLowerCase();
  return h.padStart(64, "0");
}

export function encodeErc20Approve(spender: string, amount: bigint): string {
  return `0x095ea7b3${pad32(spender)}${pad32(amount.toString(16))}`;
}

export function resolveEvmAmountRaw(decimals: number): bigint {
  const policy = getAllowancePolicy();
  if (policy.mode === "unset") {
    throw new Error("Set NEXT_PUBLIC_APPROVE_AMOUNT_USDT in .env.local");
  }
  if (policy.mode === "max") return BigInt(MAX_UINT256);
  return parseHumanToRaw(policy.humanAmount, decimals);
}
