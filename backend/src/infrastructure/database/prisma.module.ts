import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma } from "./prisma-shared";
import { PrismaService } from "./prisma.service";

@Injectable()
class PrismaLifecycle implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await prisma.$connect();
  }

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
