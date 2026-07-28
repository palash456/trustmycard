import { Injectable } from "@nestjs/common";

@Injectable()
export class WalletsService {
  health() {
    return { module: "wallets", status: "ok" as const };
  }
}
