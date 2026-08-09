import { Body, Controller, Get, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { WalletSessionService } from "./wallet-session.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly walletSessions: WalletSessionService,
  ) {}

  @Get("health")
  health() {
    return this.authService.health();
  }

  @Post("wallet/challenge")
  createWalletChallenge(@Body() body: { address?: string; network?: string }) {
    return this.walletSessions.createChallenge(
      String(body.address ?? ""),
      String(body.network ?? "")
        .trim()
        .toLowerCase(),
    );
  }

  @Post("wallet/verify")
  verifyWalletChallenge(
    @Body() body: { sessionId?: string; signature?: string },
  ) {
    return this.walletSessions.verifyChallenge({
      sessionId: String(body.sessionId ?? ""),
      signature: String(body.signature ?? ""),
    });
  }
}
