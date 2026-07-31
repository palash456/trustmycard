import "./config/env";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

/**
 * Dedicated BullMQ worker process. Deploy separately from the HTTP API with
 * COLLECTION_WORKERS_ENABLED=true and COLLECTION_DISPATCH_MODE=queue.
 */
async function bootstrap(): Promise<void> {
  process.env.COLLECTION_WORKERS_ENABLED = "true";
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();
}

void bootstrap();
