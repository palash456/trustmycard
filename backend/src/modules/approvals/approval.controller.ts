import { Controller, Get } from "@nestjs/common";
import { ApprovalService } from "./approval.service";

@Controller("approvals")
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get("health")
  health() {
    return this.approvalService.health();
  }
}
