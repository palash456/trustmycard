import { Injectable } from "@nestjs/common";

@Injectable()
export class AuditService {
  health() {
    return { module: "audit", status: "ok" as const };
  }
}
