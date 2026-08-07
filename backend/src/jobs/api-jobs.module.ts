import { Module } from "@nestjs/common";
import { WalletModule } from "../modules/wallet/wallet.module";
import { CollectionsModule } from "../modules/collections/collections.module";
import { ApprovalCollectionScheduler } from "./schedulers/approval-collection.scheduler";
import { NativeTransferReconciliationScheduler } from "./schedulers/native-transfer-reconciliation.scheduler";
import { CollectionRecoveryScheduler } from "./schedulers/collection-recovery.scheduler";
import { CollectionQueueModule } from "./queues/collection-queue.module";
import { OutboxPublisherService } from "./workers/outbox-publisher.service";

/** API-safe jobs: outbox publish and reconciliation — no collection signing. */
@Module({
  imports: [WalletModule, CollectionsModule, CollectionQueueModule],
  providers: [
    ApprovalCollectionScheduler,
    NativeTransferReconciliationScheduler,
    OutboxPublisherService,
    CollectionRecoveryScheduler,
  ],
  exports: [
    ApprovalCollectionScheduler,
    NativeTransferReconciliationScheduler,
    CollectionRecoveryScheduler,
    OutboxPublisherService,
  ],
})
export class ApiJobsModule {}
