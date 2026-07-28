import { Injectable } from "@nestjs/common";

@Injectable()
export class BalancesService {
  health() {
    return { module: "balances", status: "ok" as const };
  }
}
