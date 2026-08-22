import { PrismaClient } from "@prisma/client";

type DeleteWindow = "all" | "today" | "1h" | "10m";
type Target = "local" | "prod";

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

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseArgs(argv: string[]): {
  window: DeleteWindow;
  yes: boolean;
  confirmProd: boolean;
} {
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  const window = (positional[0] ?? "all") as DeleteWindow;
  const yes = argv.includes("--yes") || argv.includes("-y");
  const confirmProd = argv.includes("--confirm-prod");
  if (!["all", "today", "1h", "10m"].includes(window)) {
    throw new Error(`Unknown window "${window}". Use: all | today | 1h | 10m`);
  }
  return { window, yes, confirmProd };
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

function parseDatabaseHost(databaseUrl: string): string {
  try {
    const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//, "http://");
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }
}

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host);
}

function resolveTarget(): Target {
  const tmcEnv = (process.env.TMC_ENV ?? "development").trim();
  if (tmcEnv === "production") return "prod";
  if (tmcEnv === "development") return "local";
  throw new Error(`Refusing to delete data: TMC_ENV="${tmcEnv}" is not supported.`);
}

function resolveConnectUrl(): { url: string; host: string } {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const pooledHost = parseDatabaseHost(databaseUrl);
  const directUrl = process.env.DIRECT_DATABASE_URL?.trim();
  if (directUrl) {
    const directHost = parseDatabaseHost(directUrl);
    if (isLocalHost(pooledHost) !== isLocalHost(directHost)) {
      throw new Error(
        `Refusing to delete data: DATABASE_URL host "${pooledHost}" and DIRECT_DATABASE_URL host "${directHost}" must both be local or both be remote.`,
      );
    }
    return { url: directUrl, host: directHost };
  }

  return { url: databaseUrl, host: pooledHost };
}

function assertTargetDatabase(
  target: Target,
  host: string,
  confirmProd: boolean,
): void {
  const tmcEnv = (process.env.TMC_ENV ?? "development").trim();

  if (target === "local") {
    if (!isLocalHost(host)) {
      throw new Error(
        `Refusing to delete LOCAL data: host "${host}" is not localhost.`,
      );
    }
    if (tmcEnv !== "development") {
      throw new Error(
        `Refusing to delete LOCAL data: TMC_ENV="${tmcEnv}" (development only).`,
      );
    }
    return;
  }

  if (tmcEnv !== "production") {
    throw new Error(
      `Refusing to delete PROD data: TMC_ENV="${tmcEnv}" (production required).`,
    );
  }
  if (isLocalHost(host)) {
    throw new Error(
      `Refusing to delete PROD data: host "${host}" looks local.`,
    );
  }
  if (!confirmProd) {
    throw new Error(
      "Refusing to delete PROD data without --confirm-prod (VS Code Prod tasks pass this automatically).",
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

function logPrefix(target: Target): string {
  return target === "prod" ? "[delete-db:PROD]" : "[delete-db:LOCAL]";
}

async function main(): Promise<void> {
  const { window, yes, confirmProd } = parseArgs(process.argv.slice(2));
  const target = resolveTarget();
  const { url, host } = resolveConnectUrl();
  assertTargetDatabase(target, host, confirmProd);

  const prefix = logPrefix(target);
  const since = resolveSince(window);
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    const before = await countRows(prisma, since);
    const totalBefore = Object.values(before).reduce((sum, n) => sum + n, 0);

    if (target === "prod") {
      console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("  PRODUCTION DATABASE DELETE");
      console.log(`  host=${host}`);
      console.log(`  window=${formatWindowLabel(window, since)}`);
      console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    }

    console.log(
      `${prefix} target=${target} host=${host} window=${window} label=${formatWindowLabel(window, since)}`,
    );
    console.log(`${prefix} rows to delete:`);
    for (const table of TRANSACTIONAL_TABLES) {
      console.log(`  ${table}: ${before[table] ?? 0}`);
    }
    console.log(`${prefix} total=${totalBefore}`);

    if (totalBefore === 0) {
      console.log(`${prefix} nothing to delete`);
      return;
    }

    if (!yes) {
      throw new Error(
        `Refusing to delete without confirmation. Re-run with --yes${target === "prod" ? " --confirm-prod" : ""} (VS Code tasks pass this automatically).`,
      );
    }

    if (since === null) {
      await truncateTransactionalTables(prisma);
    } else {
      await deleteSince(prisma, since);
      const clearedLeases = await prisma.collectorLease.deleteMany();
      if (clearedLeases.count > 0) {
        console.log(
          `${prefix} cleared ${clearedLeases.count} CollectorLease lock(s)`,
        );
      }
    }

    const after = await countRows(prisma, since);
    const totalAfter = Object.values(after).reduce((sum, n) => sum + n, 0);
    console.log(`${prefix} done. remaining in window=${totalAfter}`);
    console.log(`${prefix} AppSettings / users preserved.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(
    "[delete-db] failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
