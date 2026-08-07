import { Module } from "@nestjs/common";
import { WorkerJobsModule } from "./jobs/worker-jobs.module";
import { AppCoreModule } from "./app-core.module";

@Module({
  imports: [AppCoreModule, WorkerJobsModule],
})
export class WorkerAppModule {}
