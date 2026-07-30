import { Global, Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import { LogSamplerService } from "./log-sampler.service";
import { StructuredLoggerService } from "./structured-logger.service";

const isDev = process.env.NODE_ENV !== "production";

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
        transport: isDev
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                singleLine: false,
                translateTime: "SYS:standard",
              },
            }
          : undefined,
        serializers: {
          err: (err: Error) => ({
            message: err.message,
            name: err.name,
            stack: err.stack,
          }),
        },
        customProps: (req) => ({
          correlationId: req.headers["x-correlation-id"],
          requestId: req.headers["x-request-id"],
        }),
        autoLogging: {
          ignore: (req) => req.url?.includes("/health") ?? false,
        },
      },
    }),
  ],
  providers: [LogSamplerService, StructuredLoggerService],
  exports: [LogSamplerService, StructuredLoggerService, PinoLoggerModule],
})
export class AppLoggerModule {}
