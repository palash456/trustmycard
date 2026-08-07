import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import {
  formatPrometheusText,
  globalMetrics,
  type MetricsSnapshot,
} from "@trustmycard/shared/observability";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";

@Controller("admin/metrics")
@UseGuards(AdminApiKeyGuard)
export class MetricsController {
  @Get()
  getSnapshot(): MetricsSnapshot {
    return globalMetrics.snapshot();
  }

  @Get("prometheus")
  @Header("content-type", "text/plain; version=0.0.4")
  getPrometheus(): string {
    return formatPrometheusText(globalMetrics.snapshot());
  }
}
