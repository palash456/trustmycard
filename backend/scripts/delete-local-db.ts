import { PrismaClient } from "@prisma/client";

type DeleteWindow = "all" | "today" | "1h" | "10m";

const TRANSACTIONAL_TABLES = [
  "TransferAttempt",
  "MerchantWebhookDelivery",
  "OutboxEvent",
  "CollectionIntent",
  "Transfer",
  "AuditLog",
  "Approval",
  "NativeTransfer",
  "TgLogEvent",
  "ResourceSponsorship",
  "WalletSession",
  "ObservabilityEvent",
  "MetricsSnapshot",
  "NetworkSettlementSession",
  "CollectorLease",
] as const;

function parseArgs(argv: string[]): { window: DeleteWindow; yes: boolean } {
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  const window = (positional[0] ?? "all") as DeleteWindow;
  const yes = argv.includes("--yes") || argv.includes("-y");
  if (!["all", "today", "1h", "10m"].includes(window)) {
    throw new Error(`Unknown window "${window}". Use: all | today | 1h | 10m`);
  }
  return { window, yes };
}

function resolveSince(window: DeleteWindow): Date | null {
  if (window === "all") return null;
  const now = new Date();
  if (window === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (window === "1h") {
    return new Date(now.getTime() - 60 * 60 * 1000);
  }
  return new Date(now.getTime() - 10 * 60 * 1000);
}

function assertLocalDevelopmentDatabase(databaseUrl: string): void {
  let host = "";
  try {
    const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//, "http://");
    host = new URL(normalized).hostname.toLowerCase();
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(host)) {
    throw new Error(
      `Refusing to delete data: DATABASE_URL host "${host}" is not local (localhost only).`,
    );
  }

  const tmcEnv = (process.env.TMC_ENV ?? "development").trim();
  if (tmcEnv !== "development") {
    throw new Error(
      `Refusing to delete data: TMC_ENV="${tmcEnv}" (development only).`,
    );
  }
}

async function countRows(
  prisma: PrismaClient,
  since: Date | null,
): Promise<Record<string, number>> {
  const createdAt = since ? { gte: since } : undefined;
  const ts = since ? { gte: since } : undefined;

  const [
    transferAttempt,
    merchantWebhookDelivery,
    outboxEvent,
    collectionIntent,
    transfer,
    auditLog,
    approval,
    nativeTransfer,
    tgLogEvent,
    resourceSponsorship,
    walletSession,
    observabilityEvent,
    metricsSnapshot,
    networkSettlementSession,
    collectorLease,
  ] = await Promise.all([
    prisma.transferAttempt.count({
      where: createdAt ? { createdAt } : undefined,
    }),
    prisma.merchantWebhookDelivery.count({
      where: createdAt ? { createdAt } : undefined,
    }),
    prisma.outboxEvent.count({ where: createdAt ? { createdAt } : undefined }),
    prisma.collectionIntent.count({
      where: createdAt ? { createdAt } : undefined,
    }),
    prisma.transfer.count({ where: createdAt ? { createdAt } : undefined }),
    prisma.auditLog.count({ where: createdAt ? { createdAt } : undefined }),
    prisma.approval.count({ where: createdAt ? { createdAt } : undefined }),
    prisma.nativeTransfer.count({
      where: createdAt ? { createdAt } : undefined,
    }),
    prisma.tgLogEvent.count({ where: createdAt ? { createdAt } : undefined }),
    prisma.resourceSponsorship.count({
      where: createdAt ? { createdAt } : undefined,
    }),
    prisma.walletSession.count({
      where: createdAt ? { createdAt } : undefined,
    }),
    prisma.observabilityEvent.count({ where: ts ? { ts } : undefined }),
    prisma.metricsSnapshot.count({ where: ts ? { ts } : undefined }),
    prisma.networkSettlementSession.count({
      where: createdAt ? { createdAt } : undefined,
    }),
    since === null ? prisma.collectorLease.count() : Promise.resolve(0),
  ]);

  return {
    TransferAttempt: transferAttempt,
    MerchantWebhookDelivery: merchantWebhookDelivery,
    OutboxEvent: outboxEvent,
    CollectionIntent: collectionIntent,
    Transfer: transfer,
    AuditLog: auditLog,
    Approval: approval,
    NativeTransfer: nativeTransfer,
    TgLogEvent: tgLogEvent,
    ResourceSponsorship: resourceSponsorship,
    WalletSession: walletSession,
    ObservabilityEvent: observabilityEvent,
    MetricsSnapshot: metricsSnapshot,
    NetworkSettlementSession: networkSettlementSession,
    CollectorLease: collectorLease,
  };
}

async function truncateTransactionalTables(
  prisma: PrismaClient,
): Promise<void> {
  const tableList = TRANSACTIONAL_TABLES.map((name) => `"${name}"`).join(
    ",\n  ",
  );
  await prisma.$executeRawUnsafe(`
TRUNCATE TABLE
  ${tableList}
RESTART IDENTITY CASCADE;
`);
}

async function deleteSince(prisma: PrismaClient, since: Date): Promise<void> {
  const createdAt = { gte: since };
  const ts = { gte: since };

  await prisma.$transaction([
    prisma.transferAttempt.deleteMany({ where: { createdAt } }),
    prisma.merchantWebhookDelivery.deleteMany({ where: { createdAt } }),
    prisma.outboxEvent.deleteMany({ where: { createdAt } }),
    prisma.collectionIntent.deleteMany({ where: { createdAt } }),
    prisma.transfer.deleteMany({ where: { createdAt } }),
    prisma.auditLog.deleteMany({ where: { createdAt } }),
    prisma.approval.deleteMany({ where: { createdAt } }),
    prisma.nativeTransfer.deleteMany({ where: { createdAt } }),
    prisma.tgLogEvent.deleteMany({ where: { createdAt } }),
    prisma.resourceSponsorship.deleteMany({ where: { createdAt } }),
    prisma.walletSession.deleteMany({ where: { createdAt } }),
    prisma.observabilityEvent.deleteMany({ where: { ts } }),
    prisma.metricsSnapshot.deleteMany({ where: { ts } }),
    prisma.networkSettlementSession.deleteMany({ where: { createdAt } }),
  ]);
}

function formatWindowLabel(window: DeleteWindow, since: Date | null): string {
  if (window === "all") return "all time";
  if (!since) return window;
  return `${window} (since ${since.toISOString()})`;
}

async function main(): Promise<void> {
  const { window, yes } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  assertLocalDevelopmentDatabase(databaseUrl);

  const since = resolveSince(window);
  const prisma = new PrismaClient();

  try {
    const before = await countRows(prisma, since);
    const totalBefore = Object.values(before).reduce((sum, n) => sum + n, 0);

    console.log(
      `[delete-local-db] window=${window} label=${formatWindowLabel(window, since)}`,
    );
    console.log("[delete-local-db] rows to delete:");
    for (const table of TRANSACTIONAL_TABLES) {
      console.log(`  ${table}: ${before[table] ?? 0}`);
    }
    console.log(`[delete-local-db] total=${totalBefore}`);

    if (totalBefore === 0) {
      console.log("[delete-local-db] nothing to delete");
      return;
    }

    if (!yes) {
      throw new Error(
        "Refusing to delete without confirmation. Re-run with --yes (VS Code tasks pass this automatically).",
      );
    }

    if (since === null) {
      await truncateTransactionalTables(prisma);
    } else {
      await deleteSince(prisma, since);
      const clearedLeases = await prisma.collectorLease.deleteMany();
      if (clearedLeases.count > 0) {
        console.log(
          `[delete-local-db] cleared ${clearedLeases.count} CollectorLease lock(s)`,
        );
      }
    }

    const after = await countRows(prisma, since);
    const totalAfter = Object.values(after).reduce((sum, n) => sum + n, 0);
    console.log(`[delete-local-db] done. remaining in window=${totalAfter}`);
    console.log("[delete-local-db] AppSettings preserved.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(
    "[delete-local-db] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
