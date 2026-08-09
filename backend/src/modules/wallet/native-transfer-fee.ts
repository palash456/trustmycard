/** Pure fee / transferable math for native transfers (unit-testable). */

export type EvmFeeQuote = {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  feeRaw: bigint;
};

export type TronFeeQuote = {
  bandwidthBytes: number;
  feeRaw: bigint;
  /** Account activation when recipient is new. */
  activationFeeRaw: bigint;
};

const BSC_LEGACY_CHAIN = "bsc" as const;
/** Exact match — signed tx value is deterministic; no percentage slack. */
const DEFAULT_MAX_UNDERFLOW_BPS = 0n;

export function applyGasLimitBuffer(
  estimated: bigint,
  numerator = 120n,
  denominator = 100n,
): bigint {
  return (estimated * numerator + denominator - 1n) / denominator;
}

export function computeEvmTransferable(args: {
  balanceRaw: bigint;
  feeQuote: EvmFeeQuote;
}): { transferableRaw: bigint; feeRaw: bigint } {
  const feeRaw = args.feeQuote.gasLimit * args.feeQuote.maxFeePerGas;
  const transferableRaw =
    args.balanceRaw > feeRaw ? args.balanceRaw - feeRaw : BigInt(0);
  return { transferableRaw, feeRaw };
}

export function computeTronTransferable(args: {
  balanceRaw: bigint;
  feeQuote: TronFeeQuote;
}): { transferableRaw: bigint; feeRaw: bigint } {
  const feeRaw = args.feeQuote.feeRaw + args.feeQuote.activationFeeRaw;
  const transferableRaw =
    args.balanceRaw > feeRaw ? args.balanceRaw - feeRaw : BigInt(0);
  return { transferableRaw, feeRaw };
}

export function isEvmLegacyGasNetwork(network: string): boolean {
  return network === BSC_LEGACY_CHAIN;
}

export function parseHexBigInt(value: string | undefined | null): bigint {
  if (!value) return BigInt(0);
  const v = value.trim();
  if (!v || v === "0x") return BigInt(0);
  return BigInt(v.startsWith("0x") ? v : `0x${v}`);
}

export function formatUnits(value: bigint, decimals: number): string {
  const neg = value < BigInt(0);
  const v = neg ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${s}` : s;
}

/** Safe TRON sun amount for APIs — never use Number(bigint). */
export function tronSunAmountString(amountRaw: bigint): string {
  if (amountRaw < BigInt(0)) {
    throw new Error("TRON amount must be non-negative");
  }
  return amountRaw.toString();
}

export function estimateTronBandwidthFee(args: {
  freeNetLimit: number;
  freeNetUsed: number;
  stakedNetLimit: number;
  stakedNetUsed: number;
  txBytes: number;
  sunPerByte: bigint;
}): TronFeeQuote {
  const freeRemaining = Math.max(0, args.freeNetLimit - args.freeNetUsed);
  const stakedRemaining = Math.max(0, args.stakedNetLimit - args.stakedNetUsed);
  const covered = freeRemaining + stakedRemaining;
  const missingBytes = Math.max(0, args.txBytes - covered);
  const feeRaw = BigInt(missingBytes) * args.sunPerByte;
  return { bandwidthBytes: args.txBytes, feeRaw, activationFeeRaw: BigInt(0) };
}

export function computeEvmActualFee(args: {
  gasUsed: bigint;
  effectiveGasPrice: bigint;
}): bigint {
  return args.gasUsed * args.effectiveGasPrice;
}

export function resolveEvmEffectiveGasPrice(args: {
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  baseFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  legacyNetwork: boolean;
}): bigint {
  if (args.legacyNetwork && args.gasPrice != null) {
    return args.gasPrice;
  }
  if (args.maxFeePerGas != null && args.maxFeePerGas > BigInt(0)) {
    return args.maxFeePerGas;
  }
  if (args.gasPrice != null && args.gasPrice > BigInt(0)) {
    return args.gasPrice;
  }
  return BigInt(0);
}

export type AmountValidationResult =
  { ok: true } | { ok: false; reason: string };

/**
 * Exact-match rule: on-chain value must equal expectedAmountRaw.
 * Gas/fees are separate from `value`; wallet UI edits that change value are rejected.
 * maxUnderflowBps defaults to 0 (exact). Set only in tests if needed.
 */
export function validateTransferAmount(args: {
  amountRaw: bigint;
  expectedAmountRaw: bigint;
  maxUnderflowBps?: bigint;
}): AmountValidationResult {
  const maxUnderflowBps = args.maxUnderflowBps ?? DEFAULT_MAX_UNDERFLOW_BPS;

  if (args.amountRaw <= BigInt(0)) {
    return { ok: false, reason: "Transfer amount must be greater than zero" };
  }
  if (args.expectedAmountRaw <= BigInt(0)) {
    return { ok: false, reason: "Expected transfer amount is invalid" };
  }
  if (args.amountRaw > args.expectedAmountRaw) {
    return {
      ok: false,
      reason: "Transfer amount exceeds the estimated maximum",
    };
  }

  const minAcceptable =
    (args.expectedAmountRaw * (BigInt(10_000) - maxUnderflowBps)) /
    BigInt(10_000);
  if (args.amountRaw < minAcceptable) {
    return {
      ok: false,
      reason:
        "Transfer amount is below the acceptable minimum for this estimate",
    };
  }

  return { ok: true };
}

export function parseTronChainSunPerByte(
  parameters: Array<{ key?: string; value?: number | string }> | undefined,
): bigint {
  const entry = parameters?.find((p) => p.key === "getTransactionFee");
  const raw = entry?.value ?? 1000;
  return BigInt(String(raw));
}

export function parseTronCreateAccountFeeSun(
  parameters: Array<{ key?: string; value?: number | string }> | undefined,
): bigint {
  const entry = parameters?.find((p) => p.key === "getCreateAccountFee");
  const raw = entry?.value ?? 100_000;
  return BigInt(String(raw));
}
