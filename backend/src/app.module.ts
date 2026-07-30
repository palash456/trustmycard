import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "./config/config.module";
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
import { AdminModule } from "./modules/admin/admin.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { JobsModule } from "./jobs/jobs.module";
import { AppLoggerModule } from "./infrastructure/logger/logger.module";
import { MetricsModule } from "./infrastructure/metrics/metrics.module";
import { CorrelationMiddleware } from "./common/middleware/correlation.middleware";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ObservabilityModule } from "./modules/observability/observability.module";

@Module({
  imports: [
    AppLoggerModule,
    MetricsModule,
    ObservabilityModule,
    ConfigModule,
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
    ResourcesModule,
    WalletModule,
    AdminModule,
    SettingsModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}
