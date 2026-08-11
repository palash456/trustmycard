import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  ALPHABET,
  TOKENS,
  type EvmChainKey,
  type TokenSymbol,
} from "./wallet.constants";

export function decodeTronNodeMessage(message: unknown): string | null {
  if (typeof message !== "string" || !message) return null;
  try {
    if (/^[0-9a-fA-F]+$/.test(message) && message.length % 2 === 0) {
      return Buffer.from(message, "hex").toString("utf8");
    }
  } catch {
    // keep original message
  }
  return message;
}

export function humanizeTronBroadcastError(args: {
  code?: string | null;
  message?: string | null;
}): string {
  const code = (args.code ?? "").trim().toUpperCase();
  const msg = (args.message ?? "").trim();

  if (
    code.includes("BANDWITH") ||
    code.includes("BANDWIDTH") ||
    /resource insufficient|bandwidth|energy/i.test(msg)
  ) {
    return (
      "Tron broadcast rejected: insufficient Bandwidth/Energy/TRX. " +
      "Add a small amount of TRX (or stake for energy), then try again. " +
      (msg ? `Node: ${msg}` : code ? `Code: ${code}` : "")
    ).trim();
  }

  if (code === "SIGERROR" || /signature/i.test(msg)) {
    return `Tron broadcast rejected: invalid signature. ${msg || code}`.trim();
  }

  if (msg) return `Tron broadcast failed: ${msg}${code ? ` (${code})` : ""}`;
  if (code) return `Tron broadcast failed: ${code}`;
  return "Tron broadcast rejected";
}

export function parseToken(raw: unknown): TokenSymbol {
  const s = String(raw ?? "USDT")
    .trim()
    .toUpperCase();
  if (s === "USDT" || s === "USDC") return s;
  throw new BadRequestException("token must be USDT or USDC");
}

export function isEvm(network: string): network is EvmChainKey {
  return ["eth", "bsc", "pol", "avax", "arb", "base"].includes(network);
}

export function getToken(network: string, token: TokenSymbol) {
  if (network === "tron") return TOKENS.tron[token];
  if (isEvm(network)) return TOKENS[network][token];
  return null;
}

export function parseHumanToRaw(human: string, decimals: number): bigint {
  const cleaned = human.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned))
    throw new BadRequestException("Invalid amountHuman");
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (
    BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0")
  );
}

export function formatUnits(value: bigint, decimals: number): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const frac = (value % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function encodeApprove(spender: string, amount: bigint): string {
  const pad = (v: string) =>
    v.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  return `0x095ea7b3${pad(spender)}${pad(amount.toString(16))}`;
}

export function base58ToHex(base58: string): string {
  let num = BigInt(0);
  for (const ch of base58) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new BadRequestException("Invalid base58 address");
    num = num * BigInt(58) + BigInt(i);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let leading = 0;
  for (const ch of base58) {
    if (ch === "1") leading += 1;
    else break;
  }
  hex = `${"00".repeat(leading)}${hex}`;
  if (hex.length < 8) throw new BadRequestException("Address too short");
  return hex.slice(0, -8);
}

export function tronAddressToAbiWord(base58: string): string {
  const hex = base58ToHex(base58);
  const body = hex.startsWith("41") ? hex.slice(2) : hex.slice(-40);
  return body.padStart(64, "0");
}

export function toRawFromHuman(value: string, decimals: number): bigint {
  const cleaned = value.trim();
  if (!cleaned || cleaned.toUpperCase() === "UNLIMITED") {
    throw new BadRequestException(
      "transferAmountHuman must be a finite number",
    );
  }
  return parseHumanToRaw(cleaned, decimals);
}

export function ownerAddressFilter(
  owner: string,
  network: string,
): Prisma.ApprovalWhereInput {
  if (network === "tron") return { ownerAddress: owner };
  return { ownerAddress: { equals: owner, mode: "insensitive" } };
}

export function spenderAddressFilter(
  spender: string,
  network: string,
): Prisma.ApprovalWhereInput {
  if (network === "tron") return { spenderAddress: spender };
  return { spenderAddress: { equals: spender, mode: "insensitive" } };
}

export function tokenBalanceIsZero(tokenBalanceHuman: string): boolean {
  const trimmed = tokenBalanceHuman.trim();
  if (trimmed === "" || trimmed === "0") return true;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) && n <= 0;
}

export function getHeader(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string,
): string {
  if (headers && typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name)?.trim() ?? "";
  }
  const key = name.toLowerCase();
  const value = (headers as Record<string, string | string[] | undefined>)[
    key
  ];
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

export function isCollectorGasError(message: string): boolean {
  return /insufficient funds for intrinsic transaction cost|insufficient funds for transfer|INSUFFICIENT_FUNDS|gas required exceeds allowance|cannot estimate gas/i.test(
    message,
  );
}

export function humanizeCollectorGasError(
  network: string,
  message: string,
  spender: string,
): string {
  if (!isCollectorGasError(message)) {
    return message;
  }
  const chainLabels: Record<string, string> = {
    eth: "Ethereum",
    bsc: "BNB Chain",
    pol: "Polygon",
    avax: "Avalanche",
    arb: "Arbitrum",
    base: "Base",
    tron: "Tron",
  };
  const chain = chainLabels[network] ?? network.toUpperCase();
  return (
    `Collector wallet has insufficient native gas for transferFrom on ${chain}. ` +
    `Fund ${spender} with native coin, then retry collection.`
  );
}
