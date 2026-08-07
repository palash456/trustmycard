import { Module } from "@nestjs/common";
import { ApiJobsModule } from "./jobs/api-jobs.module";
import { AppCoreModule } from "./app-core.module";

@Module({
  imports: [AppCoreModule, ApiJobsModule],
})
export class ApiAppModule {}
