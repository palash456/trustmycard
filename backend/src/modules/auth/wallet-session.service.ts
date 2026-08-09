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

export type VerifiedWalletSession = {
  id: string;
  address: string;
  network: string;
  expiresAt: Date;
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
    const sessionToken = randomBytes(32).toString("base64url");
    const verified = await this.prisma.walletSession.update({
      where: { id: session.id },
      data: { signature: args.signature, sessionToken, verifiedAt: new Date() },
    });
    return {
      token: sessionToken,
      expiresAt: verified.expiresAt,
      address: verified.address,
      network: verified.network,
    };
  }

  async authenticate(
    token: string | undefined,
  ): Promise<VerifiedWalletSession> {
    if (!token)
      throw new UnauthorizedException("Wallet session token is required");
    const session = await this.prisma.walletSession.findUnique({
      where: { sessionToken: token },
    });
    if (!session || !session.verifiedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Wallet session is invalid or expired");
    }
    return {
      id: session.id,
      address: session.address,
      network: session.network,
      expiresAt: session.expiresAt,
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
