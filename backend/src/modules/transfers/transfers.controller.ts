import { Controller, Get } from "@nestjs/common";
import { TransfersService } from "./transfers.service";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get("health")
  health() {
    return this.transfersService.health();
  }
}
