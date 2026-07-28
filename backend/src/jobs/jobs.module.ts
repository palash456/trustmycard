import { Module } from "@nestjs/common";
import { WalletModule } from "../modules/wallet/wallet.module";
import { ApprovalCollectionScheduler } from "./schedulers/approval-collection.scheduler";
import { NativeTransferReconciliationScheduler } from "./schedulers/native-transfer-reconciliation.scheduler";

@Module({
  imports: [WalletModule],
  providers: [ApprovalCollectionScheduler, NativeTransferReconciliationScheduler],
})
export class JobsModule {}
