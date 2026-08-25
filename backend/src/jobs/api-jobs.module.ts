import { Module } from "@nestjs/common";
import { BackgroundJobsModule } from "./background-jobs.module";

/** API-safe jobs: coordinated schedulers — no BullMQ collection signing workers. */
@Module({
  imports: [BackgroundJobsModule],
  exports: [BackgroundJobsModule],
})
export class ApiJobsModule {}
