import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Prisma, User, UserWallet } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma-shared";
import {
  buildUserPublicId,
  buildUsername,
  detectWalletChainType,
  normalizeWalletAddressForChain,
  type WalletChainType,
} from "../../common/ids/user-public-id";

const BACKFILL_SETTINGS_KEY = "users.backfillCompleted";

type WalletRow = {
  address: string;
  chainType: WalletChainType;
  firstSeen: Date;
};

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);
  private backfillPromise: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    void this.ensureBackfill();
  }

  async ensureBackfill(): Promise<void> {
    if (!this.backfillPromise) {
      this.backfillPromise = this.runBackfillIfNeeded();
    }
    await this.backfillPromise;
  }

  private async runBackfillIfNeeded(): Promise<void> {
    const setting = await prisma.appSettings.findUnique({
      where: { key: BACKFILL_SETTINGS_KEY },
    });
    if (setting?.value === true) return;

    this.logger.log("Running user/wallet backfill migration…");
    await this.backfillUsersFromHistory();
    await prisma.appSettings.upsert({
      where: { key: BACKFILL_SETTINGS_KEY },
      create: {
        key: BACKFILL_SETTINGS_KEY,
        value: true,
        category: "migration",
        updatedBy: "system",
      },
      update: { value: true, updatedBy: "system" },
    });
    this.logger.log("User/wallet backfill completed");
  }

  /**
   * Resolve or create a user for a wallet address.
   * When clientSessionId is provided, links to an existing user that shares the settlement session.
   */
  async resolveUserForWallet(
    address: string,
    options?: { clientSessionId?: string | null },
  ): Promise<User> {
    await this.ensureBackfill();

    const chainType = detectWalletChainType(address);
    if (!chainType) {
      throw new Error(`Unsupported wallet address format: ${address}`);
    }
    const normalized = normalizeWalletAddressForChain(address, chainType);

    const existingWallet = await prisma.userWallet.findUnique({
      where: { address_chainType: { address: normalized, chainType } },
      include: { user: true },
    });
    if (existingWallet) return existingWallet.user;

    const clientSessionId = options?.clientSessionId?.trim();
    if (clientSessionId) {
      const siblingUser = await this.findUserBySettlementSession(
        clientSessionId,
        normalized,
        chainType,
      );
      if (siblingUser) {
        await this.attachWallet(siblingUser.id, normalized, chainType);
        return this.refreshUserPublicId(siblingUser.id);
      }
    }

    return this.createUserWithWallet(normalized, chainType);
  }

  async findUserByWalletAddress(address: string): Promise<User | null> {
    await this.ensureBackfill();
    const chainType = detectWalletChainType(address);
    if (!chainType) return null;
    const normalized = normalizeWalletAddressForChain(address, chainType);
    const wallet = await prisma.userWallet.findUnique({
      where: { address_chainType: { address: normalized, chainType } },
      include: { user: true },
    });
    return wallet?.user ?? null;
  }

  async findUserByIdOrPublicId(idOrPublicId: string): Promise<User | null> {
    await this.ensureBackfill();
    const trimmed = idOrPublicId.trim();
    return prisma.user.findFirst({
      where: {
        OR: [{ id: trimmed }, { publicId: trimmed }, { username: trimmed }],
      },
    });
  }

  async getUserWallets(userId: string): Promise<UserWallet[]> {
    return prisma.userWallet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getWalletAddressesForUser(userId: string): Promise<string[]> {
    const wallets = await this.getUserWallets(userId);
    return wallets.map((w) => w.address);
  }

  private async findUserBySettlementSession(
    clientSessionId: string,
    excludeAddress: string,
    excludeChainType: WalletChainType,
  ): Promise<User | null> {
    const sessions = await prisma.networkSettlementSession.findMany({
      where: { clientSessionId },
      select: { ownerAddress: true },
    });
    const addresses = [
      ...new Set(sessions.map((s) => s.ownerAddress.trim()).filter(Boolean)),
    ];
    if (addresses.length === 0) return null;

    const wallets = await prisma.userWallet.findMany({
      where: {
        OR: addresses.flatMap((addr) => {
          const chain = detectWalletChainType(addr);
          if (!chain) return [];
          const normalized = normalizeWalletAddressForChain(addr, chain);
          if (normalized === excludeAddress && chain === excludeChainType) {
            return [];
          }
          return [{ address: normalized, chainType: chain }];
        }),
      },
      include: { user: true },
      take: 1,
    });
    return wallets[0]?.user ?? null;
  }

  /** Fire-and-forget wallet linking; logs warnings on failure. */
  async linkWallet(
    address: string,
    clientSessionId?: string | null,
  ): Promise<void> {
    try {
      await this.resolveUserForWallet(address, { clientSessionId });
    } catch (err) {
      this.logger.warn(
        `Failed to link wallet ${address}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async createUserWithWallet(
    address: string,
    chainType: WalletChainType,
  ): Promise<User> {
    return prisma.$transaction(async (tx) => {
      const userNumber = await this.nextUserNumber(tx);
      const evmAddress = chainType === "evm" ? address : null;
      const tronAddress = chainType === "tron" ? address : null;
      const user = await tx.user.create({
        data: {
          userNumber,
          publicId: buildUserPublicId(userNumber, evmAddress, tronAddress),
          username: buildUsername(userNumber),
        },
      });
      await tx.userWallet.create({
        data: { userId: user.id, address, chainType },
      });
      return user;
    });
  }

  private async attachWallet(
    userId: string,
    address: string,
    chainType: WalletChainType,
  ): Promise<void> {
    await prisma.userWallet.upsert({
      where: { address_chainType: { address, chainType } },
      create: { userId, address, chainType },
      update: { userId },
    });
  }

  async refreshUserPublicId(userId: string): Promise<User> {
    const wallets = await prisma.userWallet.findMany({
      where: { userId },
    });
    const evm = wallets.find((w) => w.chainType === "evm")?.address ?? null;
    const tron = wallets.find((w) => w.chainType === "tron")?.address ?? null;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const publicId = buildUserPublicId(user.userNumber, evm, tron);
    if (publicId === user.publicId) return user;
    return prisma.user.update({
      where: { id: userId },
      data: { publicId },
    });
  }

  private async nextUserNumber(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('"User_userNumber_seq"') AS nextval
    `;
    return Number(result[0]?.nextval ?? 1);
  }

  /** One-time backfill: group wallets by settlement session, assign stable user numbers. */
  private async backfillUsersFromHistory(): Promise<void> {
    const existingCount = await prisma.user.count();
    if (existingCount > 0) return;

    const walletRows = await this.collectHistoricalWallets();
    if (walletRows.length === 0) return;

    const groups = await this.buildWalletGroups(walletRows);
    groups.sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime());

    await prisma.$executeRaw`SELECT setval('"User_userNumber_seq"', 1, false)`;

    for (const group of groups) {
      await prisma.$transaction(async (tx) => {
        const userNumber = await this.nextUserNumber(tx);
        const evm = group.wallets.find((w) => w.chainType === "evm")?.address;
        const tron = group.wallets.find((w) => w.chainType === "tron")?.address;
        const user = await tx.user.create({
          data: {
            userNumber,
            publicId: buildUserPublicId(userNumber, evm, tron),
            username: buildUsername(userNumber),
          },
        });
        for (const wallet of group.wallets) {
          await tx.userWallet.create({
            data: {
              userId: user.id,
              address: wallet.address,
              chainType: wallet.chainType,
            },
          });
        }
      });
    }
  }

  private async collectHistoricalWallets(): Promise<WalletRow[]> {
    type Row = { address: string; first_seen: Date };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT address, MIN(first_seen) AS first_seen
      FROM (
        SELECT "ownerAddress" AS address, "createdAt" AS first_seen FROM "Approval"
        UNION ALL
        SELECT "fromAddress", "createdAt" FROM "Transfer"
        UNION ALL
        SELECT "ownerAddress", "createdAt" FROM "NativeTransfer"
        UNION ALL
        SELECT address, "createdAt" FROM "TgLogEvent"
        UNION ALL
        SELECT "walletAddress" AS address, ts AS first_seen
        FROM "ObservabilityEvent"
        WHERE "walletAddress" IS NOT NULL AND "walletAddress" <> ''
      ) combined
      WHERE address IS NOT NULL AND address <> ''
      GROUP BY address
    `;

    const walletMap = new Map<string, WalletRow>();
    for (const row of rows) {
      const chainType = detectWalletChainType(row.address);
      if (!chainType) continue;
      const address = normalizeWalletAddressForChain(row.address, chainType);
      const key = `${chainType}:${address}`;
      const existing = walletMap.get(key);
      if (!existing || row.first_seen < existing.firstSeen) {
        walletMap.set(key, {
          address,
          chainType,
          firstSeen: row.first_seen,
        });
      }
    }
    return [...walletMap.values()];
  }

  private async buildWalletGroups(wallets: WalletRow[]): Promise<
    Array<{
      wallets: WalletRow[];
      firstSeen: Date;
    }>
  > {
    const parent = new Map<string, string>();
    const walletKey = (w: WalletRow) => `${w.chainType}:${w.address}`;

    const find = (key: string): string => {
      const p = parent.get(key);
      if (!p || p === key) return key;
      const root = find(p);
      parent.set(key, root);
      return root;
    };

    const union = (a: string, b: string): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    for (const w of wallets) {
      const key = walletKey(w);
      if (!parent.has(key)) parent.set(key, key);
    }

    const sessions = await prisma.networkSettlementSession.findMany({
      select: { clientSessionId: true, ownerAddress: true },
    });
    const bySession = new Map<string, string[]>();
    for (const s of sessions) {
      const chain = detectWalletChainType(s.ownerAddress);
      if (!chain) continue;
      const addr = normalizeWalletAddressForChain(s.ownerAddress, chain);
      const key = `${chain}:${addr}`;
      const list = bySession.get(s.clientSessionId) ?? [];
      list.push(key);
      bySession.set(s.clientSessionId, list);
    }
    for (const keys of bySession.values()) {
      const unique = [...new Set(keys)];
      for (let i = 1; i < unique.length; i++) {
        union(unique[0], unique[i]);
      }
    }

    const groups = new Map<string, WalletRow[]>();
    for (const w of wallets) {
      const root = find(walletKey(w));
      const list = groups.get(root) ?? [];
      list.push(w);
      groups.set(root, list);
    }

    return [...groups.values()].map((groupWallets) => ({
      wallets: groupWallets,
      firstSeen: groupWallets.reduce(
        (min, w) => (w.firstSeen < min ? w.firstSeen : min),
        groupWallets[0].firstSeen,
      ),
    }));
  }
}
