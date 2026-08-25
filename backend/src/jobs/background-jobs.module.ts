import { Module } from "@nestjs/common";
import { WalletModule } from "../modules/wallet/wallet.module";
import { CollectionsModule } from "../modules/collections/collections.module";
import { CollectionQueueModule } from "./queues/collection-queue.module";
import { ApprovalCollectionScheduler } from "./schedulers/approval-collection.scheduler";
import { NativeTransferReconciliationScheduler } from "./schedulers/native-transfer-reconciliation.scheduler";
import { CollectionRecoveryScheduler } from "./schedulers/collection-recovery.scheduler";
import { OutboxPublisherService } from "./workers/outbox-publisher.service";
import { BackgroundJobsTickerService } from "./schedulers/background-jobs-ticker.service";

/** Shared background schedulers — single instance per process. */
@Module({
  imports: [WalletModule, CollectionsModule, CollectionQueueModule],
  providers: [
    BackgroundJobsTickerService,
    ApprovalCollectionScheduler,
    NativeTransferReconciliationScheduler,
    OutboxPublisherService,
    CollectionRecoveryScheduler,
  ],
  exports: [
    BackgroundJobsTickerService,
    ApprovalCollectionScheduler,
    NativeTransferReconciliationScheduler,
    OutboxPublisherService,
    CollectionRecoveryScheduler,
  ],
})
export class BackgroundJobsModule {}
