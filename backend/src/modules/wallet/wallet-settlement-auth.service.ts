import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { WalletSessionService } from "../auth/wallet-session.service";
import { getToken, parseToken } from "./wallet-crypto.util";
import { WalletApprovalService } from "./wallet-approval.service";
import { WalletRpcService } from "./wallet-rpc.service";

type RegisterTokenInput = {
  token?: string;
  txHash?: string | null;
  shouldAttemptTransfer?: boolean;
};

@Injectable()
export class WalletSettlementAuthService {
  constructor(
    private readonly sessions: WalletSessionService,
    private readonly approval: WalletApprovalService,
    private readonly rpc: WalletRpcService,
  ) {}

  /**
   * When personal_sign is disabled, establish a wallet session at settlement register.
   * Returns null when personal_sign remains enabled (caller uses Bearer from challenge).
   */
  async establishOnRegister(args: {
    clientSessionId: string;
    network: string;
    owner: string;
    tokens: RegisterTokenInput[];
  }): Promise<{ token: string; expiresAt: Date } | null> {
    if (this.sessions.isPersonalSignEnabled()) {
      return null;
    }

    const network = args.network.trim().toLowerCase();
    const owner = args.owner.trim();
    const clientSessionId = args.clientSessionId.trim();
    if (!clientSessionId || !network || !owner) {
      throw new BadRequestException(
        "sessionId, network, and owner are required",
      );
    }

    const spender = this.rpc.spenderFor(network);
    if (!spender) {
      throw new BadRequestException("Spender is not configured for network");
    }

    for (const row of args.tokens) {
      const txHash = String(row.txHash ?? "").trim();
      const tokenSymbol = row.token ? parseToken(row.token) : null;
      if (!txHash || !tokenSymbol) continue;
      const tokenInfo = getToken(network, tokenSymbol);
      if (!tokenInfo) continue;
      await this.approval.verifyApprovalReceipt({
        network,
        txHash,
        owner,
        spender,
        tokenAddress: tokenInfo.address,
      });
      return this.sessions.establishFromVerifiedTransaction({
        address: owner,
        network,
        proofTxHash: txHash,
        scopeClientSessionId: clientSessionId,
      });
    }

    const tokenSymbols = args.tokens
      .map((t) => (t.token ? parseToken(t.token) : null))
      .filter((t): t is "USDT" | "USDC" => t === "USDT" || t === "USDC");

    if (tokenSymbols.length === 0) {
      throw new UnauthorizedException(
        "Cannot establish settlement session without wallet-phase transactions or token allowances",
      );
    }

    let hasAllowance = false;
    for (const token of tokenSymbols) {
      const verified = await this.approval.verifyAllowance({
        network,
        owner,
        spender,
        token,
      });
      if (verified.hasAllowance) {
        hasAllowance = true;
        break;
      }
    }

    if (!hasAllowance) {
      throw new UnauthorizedException(
        "No verifiable wallet-phase transaction or on-chain allowance for settlement",
      );
    }

    return this.sessions.establishSettlementScopedSession({
      address: owner,
      network,
      clientSessionId,
    });
  }
}
