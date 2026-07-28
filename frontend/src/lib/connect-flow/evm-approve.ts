import { MAX_UINT256, parseHumanToRaw } from "@/lib/chain-tokens";

function pad32(hexOrAddr: string): string {
  const h = hexOrAddr.replace(/^0x/i, "").toLowerCase();
  return h.padStart(64, "0");
}

export function encodeErc20Approve(spender: string, amount: bigint): string {
  return `0x095ea7b3${pad32(spender)}${pad32(amount.toString(16))}`;
}

/**
 * Resolve approve amount from explicit user choice.
 * Unlimited is only allowed when `unlimited === true`.
 */
export function resolveApproveAmountRaw(args: {
  decimals: number;
  amountHuman: string;
  unlimited: boolean;
}): bigint {
  if (args.unlimited) {
    return BigInt(MAX_UINT256);
  }
  const human = args.amountHuman.trim();
  if (!human) {
    throw new Error("Enter a maximum amount to authorize");
  }
  const raw = parseHumanToRaw(human, args.decimals);
  if (raw <= BigInt(0)) {
    throw new Error("Amount must be greater than zero");
  }
  return raw;
}
