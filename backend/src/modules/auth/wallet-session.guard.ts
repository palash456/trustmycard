import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { WalletSessionService } from "./wallet-session.service";

@Injectable()
export class WalletSessionGuard implements CanActivate {
  constructor(private readonly sessions: WalletSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      walletSession?: unknown;
    }>();
    const raw = request.headers.authorization;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const token = value?.startsWith("Bearer ") ? value.slice(7).trim() : "";
    if (!token) throw new UnauthorizedException("Bearer wallet session token is required");
    request.walletSession = await this.sessions.authenticate(token);
    return true;
  }
}
