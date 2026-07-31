import { Global, Module } from "@nestjs/common";
import { ConfigService } from "./config.service";
import { PlatformConfigService } from "./platform-config.service";

@Global()
@Module({
  providers: [PlatformConfigService, ConfigService],
  exports: [PlatformConfigService, ConfigService],
})
export class ConfigModule {}
