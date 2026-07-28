import {
  MAX_UINT256,
  getToken,
  parseHumanToRaw,
  type TokenSymbol,
} from "@/lib/chain-tokens";

export function parseTokenSymbol(raw: unknown): TokenSymbol {
  const s = String(raw ?? "USDT").trim().toUpperCase();
  if (s === "USDT" || s === "USDC") return s;
  throw new Error("token must be USDT or USDC");
}

export function resolveUserAmountRaw(args: {
  network: string;
  token: TokenSymbol;
  amountHuman?: string;
  unlimited?: boolean;
}): {
  tokenInfo: NonNullable<ReturnType<typeof getToken>>;
  amountRaw: bigint;
  amountHuman: string;
  unlimited: boolean;
} {
  const tokenInfo = getToken(args.network, args.token);
  if (!tokenInfo) {
    throw new Error(`Token ${args.token} is not supported on ${args.network}`);
  }

  const unlimited = Boolean(args.unlimited);
  if (unlimited) {
    return {
      tokenInfo,
      amountRaw: BigInt(MAX_UINT256),
      amountHuman: "UNLIMITED",
      unlimited: true,
    };
  }

  const human = (args.amountHuman ?? "").trim();
  if (!human) {
    throw new Error("amountHuman is required unless unlimited is true");
  }
  const amountRaw = parseHumanToRaw(human, tokenInfo.decimals);
  if (amountRaw <= BigInt(0)) {
    throw new Error("amount must be greater than zero");
  }
  return { tokenInfo, amountRaw, amountHuman: human, unlimited: false };
}
