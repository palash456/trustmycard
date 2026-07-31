import { Module } from "@nestjs/common";
import { ResourcesModule } from "../resources/resources.module";
import { CollectionsModule } from "../collections/collections.module";
import { AuthModule } from "../auth/auth.module";
import { CustodyModule } from "../custody/custody.module";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { NativeTransferService } from "./native-transfer.service";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [ResourcesModule, CollectionsModule, AuthModule, CustodyModule],
  controllers: [WalletController],
  providers: [WalletService, NativeTransferService, AdminApiKeyGuard],
  exports: [WalletService, NativeTransferService],
})
export class WalletModule {}
