import { SkipThrottle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  HttpCode,
  Post,
} from "@nestjs/common";
import type { LogEvent, SessionTimeline } from "@trustmycard/shared/observability";
import { ObservabilityService } from "./observability.service";

@SkipThrottle()
@Controller()
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  /**
   * Accept client logs/timelines for async DB persistence.
   * Returns immediately — persistence runs in the background.
   */
  @Post("client-logs")
  @HttpCode(202)
  ingestClientLogs(
    @Body()
    body: {
      type?: "log" | "session_timeline";
      events?: Partial<LogEvent>[];
      timeline?: SessionTimeline;
    }
  ) {
    if (body.type === "session_timeline" && body.timeline) {
      this.observability.schedulePersistTimeline(body.timeline);
      return { ok: true, accepted: 1, kind: "session_timeline" };
    }

    const events = body.events ?? (body as unknown as Partial<LogEvent>[]);
    const list = Array.isArray(events) ? events : [body as unknown as Partial<LogEvent>];

    let accepted = 0;
    for (const event of list) {
      if (!event || typeof event !== "object") continue;
      this.observability.schedulePersistLog(event);
      accepted += 1;
    }

    return { ok: true, accepted, kind: "log" };
  }
}
