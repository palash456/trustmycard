import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/database/prisma.module";
import { AdminEventsModule } from "../../infrastructure/admin-events/admin-events.module";
import { AuthModule } from "../auth/auth.module";
import { CollectionIntentService } from "./collection-intent.service";
import { OutboxService } from "./outbox.service";
import { CollectionsController } from "./collections.controller";

@Module({
  imports: [PrismaModule, AuthModule, AdminEventsModule],
  controllers: [CollectionsController],
  providers: [CollectionIntentService, OutboxService],
  exports: [CollectionIntentService, OutboxService],
})
export class CollectionsModule {}
