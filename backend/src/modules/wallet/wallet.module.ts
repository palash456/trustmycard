import { Module } from "@nestjs/common";
import { ObservabilityModule } from "../observability/observability.module";
import { ResourcesModule } from "../resources/resources.module";
import { CollectionsModule } from "../collections/collections.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { CustodyModule } from "../custody/custody.module";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { NetworkSettlementService } from "./network-settlement.service";
import { NativeTransferService } from "./native-transfer.service";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";
import { WalletNotifyService } from "./wallet-notify.service";
import { WalletRpcService } from "./wallet-rpc.service";
import { WalletCollectorContextService } from "./wallet-collector-context.service";
import { WalletTransferExecutorService } from "./wallet-transfer-executor.service";
import { WalletReconciliationService } from "./wallet-reconciliation.service";
import { WalletApprovalService } from "./wallet-approval.service";
import { WalletCollectionService } from "./wallet-collection.service";
import { WalletNativeReadinessService } from "./wallet-native-readiness.service";
import { WalletSettlementAuthService } from "./wallet-settlement-auth.service";

@Module({
  imports: [
    ResourcesModule,
    CollectionsModule,
    AuthModule,
    UsersModule,
    CustodyModule,
    ObservabilityModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletNotifyService,
    WalletRpcService,
    WalletCollectorContextService,
    WalletTransferExecutorService,
    WalletReconciliationService,
    WalletApprovalService,
    WalletCollectionService,
    WalletNativeReadinessService,
    WalletService,
    NativeTransferService,
    NetworkSettlementService,
    WalletSettlementAuthService,
    AdminApiKeyGuard,
  ],
  exports: [WalletService, NativeTransferService, NetworkSettlementService],
})
export class WalletModule {}
