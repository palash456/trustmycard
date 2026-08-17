import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UserService } from "./user.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserService],
  exports: [UsersService, UserService],
})
export class UsersModule {}
