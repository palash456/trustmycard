import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  __trustmycardPrisma?: PrismaClient;
};

/** Single shared Prisma client for the whole process (prevents connection pool exhaustion).
 *  Connects lazily on first query so Neon can autosuspend when background jobs are idle. */
export const prisma =
  globalForPrisma.__trustmycardPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__trustmycardPrisma = prisma;
}
