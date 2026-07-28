import { Controller, Get } from "@nestjs/common";
import { BalancesService } from "./balances.service";

@Controller("balances")
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get("health")
  health() {
    return this.balancesService.health();
  }
}
