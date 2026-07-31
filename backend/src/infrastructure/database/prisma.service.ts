import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** Injection token type — resolves to the shared Prisma singleton via PrismaModule. */
@Injectable()
export class PrismaService extends PrismaClient {}
