import { Module } from "@nestjs/common";
import { ObservabilityModule } from "../observability/observability.module";
import { ResourcesModule } from "../resources/resources.module";
import { CollectionsModule } from "../collections/collections.module";
import { AuthModule } from "../auth/auth.module";
import { CustodyModule } from "../custody/custody.module";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { NetworkSettlementService } from "./network-settlement.service";
import { NativeTransferService } from "./native-transfer.service";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [
    ResourcesModule,
    CollectionsModule,
    AuthModule,
    CustodyModule,
    ObservabilityModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    NativeTransferService,
    NetworkSettlementService,
    AdminApiKeyGuard,
  ],
  exports: [WalletService, NativeTransferService, NetworkSettlementService],
})
export class WalletModule {}
