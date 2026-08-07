import "./config/env";
import { NestFactory } from "@nestjs/core";
import { WorkerAppModule } from "./worker-app.module";

/**
 * Dedicated BullMQ worker process. Deploy separately from the HTTP API with
 * COLLECTION_WORKERS_ENABLED=true and COLLECTION_DISPATCH_MODE=queue.
 */
async function bootstrap(): Promise<void> {
  if (!process.env.SERVICE_ROLE) process.env.SERVICE_ROLE = "worker";
  process.env.COLLECTION_WORKERS_ENABLED = "true";
  if (!process.env.COLLECTION_SIGNING_ENABLED) {
    process.env.COLLECTION_SIGNING_ENABLED = "true";
  }
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();
}

void bootstrap();
