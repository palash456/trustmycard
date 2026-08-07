import { Module } from "@nestjs/common";
import { ApiJobsModule } from "./jobs/api-jobs.module";
import { WorkerJobsModule } from "./jobs/worker-jobs.module";
import { AppCoreModule } from "./app-core.module";

/**
 * Monolith module for local development (SERVICE_ROLE=all).
 * Production Render deploys use ApiAppModule or WorkerAppModule instead.
 */
@Module({
  imports: [AppCoreModule, ApiJobsModule, WorkerJobsModule],
})
export class AppModule {}
