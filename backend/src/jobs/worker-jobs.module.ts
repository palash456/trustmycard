import { Module } from "@nestjs/common";
import { WalletModule } from "../modules/wallet/wallet.module";
import { BackgroundJobsModule } from "./background-jobs.module";
import { CollectionQueueModule } from "./queues/collection-queue.module";
import { CollectionExecutionWorker } from "./workers/collection-execution.worker";
import { CollectionConfirmationWorker } from "./workers/collection-confirmation.worker";
import { MerchantWebhookWorker } from "./workers/merchant-webhook.worker";

/** Worker-only jobs: BullMQ consumers plus shared background schedulers. */
@Module({
  imports: [BackgroundJobsModule, CollectionQueueModule, WalletModule],
  providers: [
    CollectionExecutionWorker,
    CollectionConfirmationWorker,
    MerchantWebhookWorker,
  ],
  exports: [BackgroundJobsModule],
})
export class WorkerJobsModule {}
