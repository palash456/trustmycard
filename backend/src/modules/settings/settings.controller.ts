import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "../../config/config.service";

@ApiTags("Settings")
@Controller("api/settings")
export class SettingsController {
  constructor(private readonly configService: ConfigService) {}

  @Get("public")
  @ApiOperation({ summary: "Public platform settings for website/wallet-sdk" })
  getPublic() {
    return {
      ok: true,
      settings: this.configService.getPublicSettings(),
      timestamp: new Date().toISOString(),
    };
  }
}
