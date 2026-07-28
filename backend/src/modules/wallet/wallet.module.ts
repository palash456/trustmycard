import { Module } from "@nestjs/common";
import { ResourcesModule } from "../resources/resources.module";
import { NativeTransferService } from "./native-transfer.service";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [ResourcesModule],
  controllers: [WalletController],
  providers: [WalletService, NativeTransferService],
  exports: [WalletService, NativeTransferService],
})
export class WalletModule {}
