import { Injectable } from "@nestjs/common";

@Injectable()
export class TransfersService {
  health() {
    return { module: "transfers", status: "ok" as const };
  }
}
