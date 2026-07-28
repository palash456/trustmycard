import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationsService {
  health() {
    return { module: "notifications", status: "ok" as const };
  }
}
