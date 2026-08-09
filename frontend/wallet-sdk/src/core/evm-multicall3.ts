import { encodeErc20Approve, resolveApproveAmountRaw } from "./evm-approve";
import { MAX_UINT256 } from "./chain-tokens";
import { withSilentWalletCancellation } from "./errors";
import type { UniversalProvider } from "../types";

/** Canonical Multicall3 deployment on major EVM chains. */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862eBb2fC8aF65cE";

const AGGREGATE3_SELECTOR = "0x82ad56cb";

function pad32(hexOrNum: string): string {
  const h = hexOrNum.replace(/^0x/i, "").toLowerCase();
  return h.padStart(64, "0");
}

function strip0x(hex: string): string {
  return hex.replace(/^0x/i, "");
}

/**
 * ABI-encode Multicall3.aggregate3 for (address,bool,bytes)[] calls.
 */
export function encodeMulticall3Aggregate3(
  calls: Array<{ target: string; allowFailure: boolean; callData: string }>,
): string {
  const structSections: string[] = [];
  const arrayOffsetSlots: string[] = [pad32(calls.length.toString(16))];

  let structOffsetBytes = calls.length * 32;
  for (const call of calls) {
    arrayOffsetSlots.push(pad32(structOffsetBytes.toString(16)));

    const bytes = strip0x(call.callData);
    const byteLen = bytes.length / 2;
    const paddedBytes = bytes.padEnd(Math.ceil(byteLen / 32) * 64, "0");
    const section =
      pad32(call.target.slice(2)) +
      pad32(call.allowFailure ? "1" : "0") +
      pad32("60") +
      pad32(byteLen.toString(16)) +
      paddedBytes;

    structSections.push(section);
    structOffsetBytes += section.length / 2;
  }

  return (
    AGGREGATE3_SELECTOR +
    pad32("20") +
    arrayOffsetSlots.join("") +
    structSections.join("")
  );
}

export type Multicall3ApproveCall = {
  tokenAddress: string;
  spender: string;
  unlimited: boolean;
  amountHuman?: string;
  decimals: number;
};

export function buildMulticall3DualApproveCalldata(
  calls: Multicall3ApproveCall[],
): string {
  const inner = calls.map((call) => {
    const amount = call.unlimited
      ? BigInt(MAX_UINT256)
      : resolveApproveAmountRaw({
          decimals: call.decimals,
          amountHuman: call.amountHuman ?? "",
          unlimited: false,
        });
    return {
      target: call.tokenAddress,
      allowFailure: false,
      callData: encodeErc20Approve(call.spender, amount),
    };
  });
  return encodeMulticall3Aggregate3(inner);
}

export async function sendMulticall3Transaction(args: {
  provider: UniversalProvider;
  chainId: number;
  from: string;
  data: string;
}): Promise<string> {
  const chain = `eip155:${args.chainId}`;
  const txBase = {
    from: args.from,
    to: MULTICALL3_ADDRESS,
    data: args.data,
    value: "0x0",
  };

  let gas: string | undefined;
  try {
    const estimated = await args.provider.request(
      { method: "eth_estimateGas", params: [txBase] },
      chain,
    );
    if (typeof estimated === "string" && estimated) {
      const estimatedGas = BigInt(estimated);
      const buffered = estimatedGas + estimatedGas / BigInt(5);
      gas = `0x${buffered.toString(16)}`;
    }
  } catch {
    /* wallet may not support estimate — rely on wallet default */
  }

  const hash = await withSilentWalletCancellation(() =>
    args.provider.request(
      {
        method: "eth_sendTransaction",
        params: [gas ? { ...txBase, gas } : txBase],
      },
      chain,
    ),
  );
  if (typeof hash !== "string" || !hash) {
    throw new Error("Multicall3 sendTransaction returned empty hash");
  }
  return hash;
}
