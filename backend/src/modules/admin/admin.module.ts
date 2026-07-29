import { Module } from "@nestjs/common";
import { JobsModule } from "../../jobs/jobs.module";
import { WalletModule } from "../wallet/wallet.module";
import { AdminController } from "./admin.controller";
import { AdminDevOpsService } from "./admin-devops.service";
import { AdminOpsService } from "./admin-ops.service";
import { AdminService } from "./admin.service";
import { AdminStreamService } from "./admin-stream.service";
import { UserAggregationService } from "./user-aggregation.service";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";

@Module({
  imports: [WalletModule, JobsModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminOpsService,
    AdminStreamService,
    AdminDevOpsService,
    UserAggregationService,
    AdminApiKeyGuard,
  ],
})
export class AdminModule {}
