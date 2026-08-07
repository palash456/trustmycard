import { Module } from "@nestjs/common";
import { ApiJobsModule } from "./api-jobs.module";
import { WorkerJobsModule } from "./worker-jobs.module";

/**
 * @deprecated Use ApiJobsModule or WorkerJobsModule directly.
 * Kept for backward compatibility in tests and monolith AppModule.
 */
@Module({
  imports: [ApiJobsModule, WorkerJobsModule],
  exports: [ApiJobsModule, WorkerJobsModule],
})
export class JobsModule {}
