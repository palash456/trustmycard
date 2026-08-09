import "./config/env";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import { resolveHttpAppModule } from "./resolve-app-module";
import { StructuredLoggerService } from "./infrastructure/logger/structured-logger.service";

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const AppModule = resolveHttpAppModule();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix("v1");

  const origins = [
    ...parseOrigins(process.env.APP_ORIGIN),
    ...parseOrigins(process.env.ADMIN_ORIGIN),
  ];
  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const swaggerEnabled =
    (process.env.SWAGGER_ENABLED ?? "false").toLowerCase() === "true";
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Trust My Card API")
      .setDescription(
        "Backend API for wallet approvals, balances, and admin flows",
      )
      .setVersion("1.0.0")
      .addApiKey(
        { type: "apiKey", name: "x-admin-api-key", in: "header" },
        "adminApiKey",
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("v1/docs", app, document);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);

  const structured = app.get(StructuredLoggerService);
  structured.emit({
    level: "info",
    module: "bootstrap",
    operation: "startup",
    stage: "COMPLETE",
    status: "success",
    message: `Trust My Card API listening on :${port}`,
    context: {
      port,
      swagger: swaggerEnabled ? "/v1/docs" : null,
      serviceRole: process.env.SERVICE_ROLE ?? "all",
    },
    skipSampling: true,
  });
}

void bootstrap();
