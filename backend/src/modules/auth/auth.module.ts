import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import {
  WalletBearerOptionalGuard,
  WalletSessionGuard,
} from "./wallet-session.guard";
import { WalletSessionService } from "./wallet-session.service";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    WalletSessionService,
    WalletSessionGuard,
    WalletBearerOptionalGuard,
  ],
  exports: [
    AuthService,
    WalletSessionService,
    WalletSessionGuard,
    WalletBearerOptionalGuard,
  ],
})
export class AuthModule {}
