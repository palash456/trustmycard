import { Module } from "@nestjs/common";
import { WalletModule } from "../modules/wallet/wallet.module";
import { CollectionsModule } from "../modules/collections/collections.module";
import { ApprovalCollectionScheduler } from "./schedulers/approval-collection.scheduler";
import { NativeTransferReconciliationScheduler } from "./schedulers/native-transfer-reconciliation.scheduler";
import { CollectionRecoveryScheduler } from "./schedulers/collection-recovery.scheduler";
import { CollectionQueueModule } from "./queues/collection-queue.module";
import { CollectionExecutionWorker } from "./workers/collection-execution.worker";
import { CollectionConfirmationWorker } from "./workers/collection-confirmation.worker";
import { OutboxPublisherService } from "./workers/outbox-publisher.service";
import { MerchantWebhookWorker } from "./workers/merchant-webhook.worker";

/** Worker-only jobs: BullMQ consumers and optional schedulers when running standalone. */
@Module({
  imports: [WalletModule, CollectionsModule, CollectionQueueModule],
  providers: [
    ApprovalCollectionScheduler,
    NativeTransferReconciliationScheduler,
    OutboxPublisherService,
    CollectionExecutionWorker,
    CollectionConfirmationWorker,
    MerchantWebhookWorker,
    CollectionRecoveryScheduler,
  ],
  exports: [
    ApprovalCollectionScheduler,
    NativeTransferReconciliationScheduler,
    CollectionRecoveryScheduler,
    OutboxPublisherService,
  ],
})
export class WorkerJobsModule {}
