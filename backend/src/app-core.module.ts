import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule } from "./config/config.module";
import { ApprovalsModule } from "./modules/approvals/approval.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CustodyModule } from "./modules/custody/custody.module";
import { BlockchainModule } from "./modules/blockchain/blockchain.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { AdminEventsModule } from "./infrastructure/admin-events/admin-events.module";
import { AppLoggerModule } from "./infrastructure/logger/logger.module";
import { MetricsModule } from "./infrastructure/metrics/metrics.module";
import { CorrelationMiddleware } from "./common/middleware/correlation.middleware";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ObservabilityModule } from "./modules/observability/observability.module";
import { PrismaModule } from "./infrastructure/database/prisma.module";

/** Shared domain modules for API and worker processes. */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),
    AdminEventsModule,
    AppLoggerModule,
    MetricsModule,
    ObservabilityModule,
    PrismaModule,
    ConfigModule,
    AuthModule,
    UsersModule,
    ApprovalsModule,
    AuditModule,
    CustodyModule,
    BlockchainModule,
    ResourcesModule,
    WalletModule,
    AdminModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppCoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}
