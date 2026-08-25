import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
} from "@nestjs/common";
import { prisma } from "./prisma-shared";
import { PrismaService } from "./prisma.service";

@Injectable()
class PrismaLifecycle implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await prisma.$disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useValue: prisma,
    },
    PrismaLifecycle,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
