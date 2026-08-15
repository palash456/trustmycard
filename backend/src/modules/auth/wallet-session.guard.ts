import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  extractBearerToken,
  extractClientSessionId,
} from "./wallet-auth.util";
import { WalletSessionService } from "./wallet-session.service";

/**
 * Requires a valid Bearer wallet session (personal_sign or tx-established).
 * Validates settlement-scoped tokens against sessionId/traceId in the body.
 */
@Injectable()
export class WalletSessionGuard implements CanActivate {
  constructor(private readonly sessions: WalletSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body?: Record<string, unknown>;
      walletSession?: unknown;
    }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException("Bearer wallet session token is required");
    }
    request.walletSession = await this.sessions.authenticate(token, {
      clientSessionId: extractClientSessionId(request.body),
    });
    return true;
  }
}

/**
 * When WALLET_PERSONAL_SIGN_ENABLED=true: same as WalletSessionGuard.
 * When false: Bearer is optional; downstream handlers establish tx-backed sessions.
 */
@Injectable()
export class WalletBearerOptionalGuard implements CanActivate {
  constructor(private readonly sessions: WalletSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body?: Record<string, unknown>;
      walletSession?: unknown;
    }>();
    const token = extractBearerToken(request.headers.authorization);
    if (token) {
      request.walletSession = await this.sessions.authenticate(token, {
        clientSessionId: extractClientSessionId(request.body),
      });
      return true;
    }
    if (this.sessions.isPersonalSignEnabled()) {
      throw new UnauthorizedException("Bearer wallet session token is required");
    }
    return true;
  }
}
