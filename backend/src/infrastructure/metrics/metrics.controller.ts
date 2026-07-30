import { Controller, Get, Header } from "@nestjs/common";
import {
  formatPrometheusText,
  globalMetrics,
  type MetricsSnapshot,
} from "@trustmycard/shared/observability";

@Controller("admin/metrics")
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
