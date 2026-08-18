import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "crypto";
import { ethers } from "ethers";
import { TronWeb } from "tronweb";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { PlatformConfigService } from "../../config/platform-config.service";

export type WalletAuthMethod =
  "personal_sign" | "tx_verified" | "settlement_scoped";

export type VerifiedWalletSession = {
  id: string;
  address: string;
  network: string;
  expiresAt: Date;
  authMethod: WalletAuthMethod;
  scopeClientSessionId: string | null;
};

export type WalletSessionScope = {
  clientSessionId?: string;
};

@Injectable()
export class WalletSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformConfig: PlatformConfigService,
  ) {}

  private sessionTtlMs(): number {
    return this.platformConfig.getSession().walletSessionTtlMs;
  }

  isPersonalSignEnabled(): boolean {
    return this.platformConfig.getSession().walletPersonalSignEnabled;
  }

  async createChallenge(address: string, network: string) {
    const normalizedAddress = this.normalize(address, network);
    const nonce = randomUUID();
    const challenge = `TrustMyCard wallet session\nAddress: ${normalizedAddress}\nNetwork: ${network}\nNonce: ${nonce}`;
    const expiresAt = new Date(Date.now() + this.sessionTtlMs());
    const session = await this.prisma.walletSession.create({
      data: {
        address: normalizedAddress,
        network,
        nonce,
        challenge,
        expiresAt,
        authMethod: "personal_sign",
      },
    });
    return { sessionId: session.id, challenge, expiresAt: session.expiresAt };
  }

  async verifyChallenge(args: { sessionId: string; signature: string }) {
    const session = await this.prisma.walletSession.findUnique({
      where: { id: args.sessionId },
    });
    if (!session || session.expiresAt <= new Date() || session.verifiedAt) {
      throw new UnauthorizedException(
        "Wallet challenge is expired or already used",
      );
    }
    const signer = await this.verifySignature(
      session.network,
      session.challenge,
      args.signature,
    );
    if (this.normalize(signer, session.network) !== session.address) {
      throw new UnauthorizedException(
        "Wallet signature does not match challenge address",
      );
    }
    const minted = await this.mintSessionToken({
      sessionId: session.id,
      signature: args.signature,
      authMethod: "personal_sign",
    });
    return {
      token: minted.token,
      expiresAt: minted.expiresAt,
      address: session.address,
      network: session.network,
    };
  }

  async authenticate(
    token: string | undefined,
    scope?: WalletSessionScope,
  ): Promise<VerifiedWalletSession> {
    if (!token)
      throw new UnauthorizedException("Wallet session token is required");
    const session = await this.prisma.walletSession.findUnique({
      where: { sessionToken: token },
    });
    if (!session || !session.verifiedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Wallet session is invalid or expired");
    }
    this.assertSessionScope(session, scope);
    return this.toVerifiedSession(session);
  }

  /**
   * Issue a wallet session after an on-chain transaction has been verified.
   * Session address is always the transaction signer (not merely body.owner).
   */
  async establishFromVerifiedTransaction(args: {
    address: string;
    network: string;
    proofTxHash: string;
    scopeClientSessionId?: string | null;
  }): Promise<{ token: string; expiresAt: Date }> {
    const normalizedAddress = this.normalize(args.address, args.network);
    const network = args.network.trim().toLowerCase();
    const proofTxHash = args.proofTxHash.trim();
    if (!proofTxHash) {
      throw new BadRequestException("proofTxHash is required");
    }

    const existing = await this.prisma.walletSession.findFirst({
      where: {
        network,
        address: normalizedAddress,
        proofTxHash,
        verifiedAt: { not: null },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.sessionToken) {
      return {
        token: existing.sessionToken,
        expiresAt: existing.expiresAt,
      };
    }

    const nonce = randomUUID();
    const challenge = `tx-verified:${network}:${proofTxHash}:${nonce}`;
    const expiresAt = new Date(Date.now() + this.sessionTtlMs());
    const session = await this.prisma.walletSession.create({
      data: {
        address: normalizedAddress,
        network,
        nonce,
        challenge,
        expiresAt,
        authMethod: "tx_verified",
        proofTxHash,
        scopeClientSessionId: args.scopeClientSessionId ?? null,
      },
    });
    return this.mintSessionToken({
      sessionId: session.id,
      authMethod: "tx_verified",
    });
  }

  /**
   * Narrow-scoped session for journeys with no new wallet-phase txs (already authorized).
   * Token is bound to clientSessionId and cannot be used for other journeys.
   */
  async establishSettlementScopedSession(args: {
    address: string;
    network: string;
    clientSessionId: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    const normalizedAddress = this.normalize(args.address, args.network);
    const network = args.network.trim().toLowerCase();
    const clientSessionId = args.clientSessionId.trim();
    if (!clientSessionId) {
      throw new BadRequestException("clientSessionId is required");
    }

    const existing = await this.prisma.walletSession.findFirst({
      where: {
        network,
        address: normalizedAddress,
        authMethod: "settlement_scoped",
        scopeClientSessionId: clientSessionId,
        verifiedAt: { not: null },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.sessionToken) {
      return {
        token: existing.sessionToken,
        expiresAt: existing.expiresAt,
      };
    }

    const nonce = randomUUID();
    const challenge = `settlement-scoped:${clientSessionId}:${network}:${normalizedAddress}:${nonce}`;
    const expiresAt = new Date(Date.now() + this.sessionTtlMs());
    const session = await this.prisma.walletSession.create({
      data: {
        address: normalizedAddress,
        network,
        nonce,
        challenge,
        expiresAt,
        authMethod: "settlement_scoped",
        scopeClientSessionId: clientSessionId,
      },
    });
    return this.mintSessionToken({
      sessionId: session.id,
      authMethod: "settlement_scoped",
    });
  }

  private async mintSessionToken(args: {
    sessionId: string;
    authMethod: WalletAuthMethod;
    signature?: string | null;
  }): Promise<{ token: string; expiresAt: Date }> {
    const sessionToken = randomBytes(32).toString("base64url");
    const verified = await this.prisma.walletSession.update({
      where: { id: args.sessionId },
      data: {
        signature: args.signature ?? null,
        sessionToken,
        verifiedAt: new Date(),
        authMethod: args.authMethod,
      },
    });
    return { token: sessionToken, expiresAt: verified.expiresAt };
  }

  private assertSessionScope(
    session: {
      authMethod: string;
      scopeClientSessionId: string | null;
    },
    scope?: WalletSessionScope,
  ): void {
    if (session.authMethod !== "settlement_scoped") return;
    const required = session.scopeClientSessionId?.trim();
    if (!required) return;
    const provided = scope?.clientSessionId?.trim();
    if (!provided || provided !== required) {
      throw new UnauthorizedException(
        "Wallet session is scoped to a different settlement journey",
      );
    }
  }

  private toVerifiedSession(session: {
    id: string;
    address: string;
    network: string;
    expiresAt: Date;
    authMethod: string;
    scopeClientSessionId: string | null;
  }): VerifiedWalletSession {
    const authMethod = session.authMethod as WalletAuthMethod;
    return {
      id: session.id,
      address: session.address,
      network: session.network,
      expiresAt: session.expiresAt,
      authMethod,
      scopeClientSessionId: session.scopeClientSessionId,
    };
  }

  private async verifySignature(
    network: string,
    message: string,
    signature: string,
  ): Promise<string> {
    if (network === "tron") {
      try {
        const tron = new TronWeb({
          fullHost: this.platformConfig.getChains().tronFullHost,
        });
        return await tron.trx.verifyMessageV2(message, signature);
      } catch {
        throw new UnauthorizedException("Invalid TRON wallet signature");
      }
    }
    try {
      return ethers.utils.verifyMessage(message, signature);
    } catch {
      throw new UnauthorizedException("Invalid wallet signature");
    }
  }

  private normalize(address: string, network: string): string {
    const value = address.trim();
    if (!value) throw new BadRequestException("Wallet address is required");
    return network === "tron" ? value : value.toLowerCase();
  }
}
