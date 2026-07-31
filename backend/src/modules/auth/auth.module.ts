import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { WalletSessionGuard } from "./wallet-session.guard";
import { WalletSessionService } from "./wallet-session.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, WalletSessionService, WalletSessionGuard],
  exports: [AuthService, WalletSessionService, WalletSessionGuard],
})
export class AuthModule {}
