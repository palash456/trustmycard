import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { AdminActor } from "../../common/decorators/admin-actor.decorator";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { ProductionConfigService } from "./production-config.service";

@ApiTags("Admin production config")
@ApiSecurity("adminApiKey")
@UseGuards(AdminApiKeyGuard)
@Controller("api/admin/production-config")
export class ProductionConfigController {
  constructor(private readonly config: ProductionConfigService) {}
  private enabled(): void {
    if (process.env.ADMIN_PRODUCTION_CONFIG_ENABLED !== "true")
      throw new ForbiddenException(
        "Production configuration control is disabled",
      );
  }
  @Get() status() {
    this.enabled();
    return this.config.status();
  }
  @Get("history") history(@Query("limit") limit?: string) {
    this.enabled();
    return this.config.history(limit);
  }
  @Post("domain") domain(
    @Body() body: { domain?: unknown },
    @AdminActor() actor: string,
  ) {
    this.enabled();
    if (typeof body?.domain !== "string")
      throw new ForbiddenException("domain must be a string");
    return this.config.start("domain", body.domain, actor);
  }
  @Post("pixel") pixel(
    @Body() body: { pixel?: unknown },
    @AdminActor() actor: string,
  ) {
    this.enabled();
    if (typeof body?.pixel !== "string")
      throw new ForbiddenException("pixel must be a string");
    return this.config.start("pixel", body.pixel, actor);
  }
  @Get("stream/:changeId") @Sse() stream(
    @Param("changeId") changeId: string,
  ): Observable<{ data: string }> {
    this.enabled();
    return this.config.stream(changeId);
  }
}
