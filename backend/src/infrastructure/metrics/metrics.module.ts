import { Global, Module } from "@nestjs/common";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { MetricsController } from "./metrics.controller";

@Global()
@Module({
  controllers: [MetricsController],
  providers: [AdminApiKeyGuard],
})
export class MetricsModule {}
