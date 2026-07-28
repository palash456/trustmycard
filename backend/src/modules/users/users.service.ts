import { Injectable } from "@nestjs/common";

@Injectable()
export class UsersService {
  health() {
    return { module: "users", status: "ok" as const };
  }
}
