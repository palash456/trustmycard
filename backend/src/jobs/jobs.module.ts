import { Module } from "@nestjs/common";
import { WalletModule } from "../modules/wallet/wallet.module";
import { ApprovalCollectionScheduler } from "./schedulers/approval-collection.scheduler";

@Module({
  imports: [WalletModule],
  providers: [ApprovalCollectionScheduler],
})
export class JobsModule {}
