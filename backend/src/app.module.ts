import { Module } from "@nestjs/common";
import { ApprovalsModule } from "./modules/approvals/approval.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { WalletsModule } from "./modules/wallets/wallets.module";
import { BalancesModule } from "./modules/balances/balances.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CustodyModule } from "./modules/custody/custody.module";
import { BlockchainModule } from "./modules/blockchain/blockchain.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { JobsModule } from "./jobs/jobs.module";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WalletsModule,
    ApprovalsModule,
    BalancesModule,
    TransfersModule,
    NotificationsModule,
    AnalyticsModule,
    AuditModule,
    CustodyModule,
    BlockchainModule,
    WalletModule,
    JobsModule,
  ],
})
export class AppModule {}
