import { Injectable } from "@nestjs/common";

@Injectable()
export class AnalyticsService {
  health() {
    return { module: "analytics", status: "ok" as const };
  }
}
