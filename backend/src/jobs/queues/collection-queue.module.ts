import { Module } from "@nestjs/common";
import { CollectionQueueService } from "./collection-queue.service";

@Module({
  providers: [CollectionQueueService],
  exports: [CollectionQueueService],
})
export class CollectionQueueModule {}
