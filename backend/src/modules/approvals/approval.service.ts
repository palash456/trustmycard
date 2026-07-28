import { Injectable } from "@nestjs/common";

@Injectable()
export class ApprovalService {
  health() {
    return { module: "approvals", status: "ok" as const };
  }
}
