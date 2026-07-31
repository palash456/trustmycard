import { Module } from "@nestjs/common";
import { JobsModule } from "../../jobs/jobs.module";
import { ObservabilityModule } from "../observability/observability.module";
import { WalletModule } from "../wallet/wallet.module";
import { AdminController } from "./admin.controller";
import { AdminDevOpsService } from "./admin-devops.service";
import { AdminOpsService } from "./admin-ops.service";
import { AdminService } from "./admin.service";
import { AdminStreamService } from "./admin-stream.service";
import { AnalyticsService } from "./analytics.service";
import { UserAggregationService } from "./user-aggregation.service";
import { PipelineBuilderService } from "./pipeline/pipeline-builder.service";
import { ActivityFeedService } from "./activity-feed.service";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { CollectionQueueModule } from "../../jobs/queues/collection-queue.module";
import { CollectionsModule } from "../collections/collections.module";
import { AdminCollectionsService } from "./admin-collections.service";

@Module({
  imports: [WalletModule, JobsModule, ObservabilityModule, CollectionQueueModule, CollectionsModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminOpsService,
    AdminStreamService,
    AdminDevOpsService,
    UserAggregationService,
    PipelineBuilderService,
    AnalyticsService,
    ActivityFeedService,
    AdminApiKeyGuard,
    AdminCollectionsService,
  ],
})
export class AdminModule {}
