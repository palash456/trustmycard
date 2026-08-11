import { Injectable, Logger } from "@nestjs/common";
import { getErrorMessage } from "@trustmycard/shared/observability";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { TronWeb } from "tronweb";
import type {
  ChainResourceProvider,
  ResourceRequirement,
  ResourceResult,
  ResourceStatus as ResourceStatusType,
} from "./types";
import { ResourceStatus, resourceResult } from "./types";
import { PlatformConfigService } from "../../../config/platform-config.service";
import { ConfigService } from "../../../config/config.service";
import { SETTING_KEYS } from "../../../config/settings-keys";

import { prisma } from "../../../infrastructure/database/prisma-shared";
import {
  energyTargetToDelegateSun,
  parseNetworkEnergyWeights,
} from "./tron-energy-sizing";

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** Always-activated mainnet contract used as fallback for network energy weights. */
const TRON_NETWORK_WEIGHT_FALLBACK_ADDRESS =
  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type SponsorshipRow = {
  status: string;
  provider: string;
  amountRaw: string | null;
  txHash: string | null;
  expiresAt: Date;
};

function decodePossiblyHex(message: string): string {
  const m = message.trim();
  if (/^[0-9a-fA-F]+$/.test(m) && m.length % 2 === 0 && m.length >= 8) {
    try {
      return Buffer.from(m, "hex").toString("utf8");
    } catch {
      return m;
    }
  }
  return m;
}

/**
 * TRON-only resource provider.
 * Maps ENERGY / Stake 2.0 / rental outcomes onto shared ResourceResult statuses.
 */
@Injectable()
export class TronResourceProvider implements ChainResourceProvider {
  readonly name = "tron";
  readonly networks = ["tron"] as const;
  private readonly logger = new Logger(TronResourceProvider.name);

  constructor(
    private readonly platformConfig: PlatformConfigService,
    private readonly configService: ConfigService,
  ) {}

  private tronFullHost(): string {
    return this.platformConfig.getChains().tronFullHost;
  }

  private tronHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const apiKey = this.platformConfig.getChains().trongridApiKey;
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    return headers;
  }

  private delegatorPrivateKey(): string {
    return this.platformConfig.getWallets().tronEnergyDelegatorPrivateKey;
  }

  supports(network: string): boolean {
    return network.toLowerCase() === "tron";
  }

  async acquire(req: ResourceRequirement): Promise<ResourceResult> {
    const address = req.address.trim();
    const purpose = req.purpose || "approve";

    if (!TRON_ADDRESS_RE.test(address)) {
      return resourceResult({
        status: ResourceStatus.FAILED,
        network: "tron",
        address,
        provider: this.name,
        message: "Invalid TRON address",
      });
    }

    if (!this.isEnabled()) {
      return resourceResult({
        status: ResourceStatus.PROVIDER_UNAVAILABLE,
        network: "tron",
        address,
        provider: this.name,
        message: "Resource sponsorship disabled",
        detail: { reason: "sponsorship_disabled" },
      });
    }

    const existing = await this.findSponsorship(address, purpose);
    const now = Date.now();
    if (existing && new Date(existing.expiresAt).getTime() > now) {
      if (existing.status === "sent") {
        this.logger.log(
          `TRON acquire ALREADY_AVAILABLE address=${address} ref=${existing.txHash}`,
        );
        return resourceResult({
          status: ResourceStatus.ALREADY_AVAILABLE,
          network: "tron",
          address,
          provider: existing.provider || this.name,
          acquisitionId: existing.txHash,
          message: "Resources already acquired for this address",
        });
      }
      if (existing.status === "pending") {
        this.logger.log(
          `TRON acquire PENDING (in-flight) address=${address} ref=${existing.txHash}`,
        );
        return resourceResult({
          status: ResourceStatus.PENDING,
          network: "tron",
          address,
          provider: existing.provider || this.name,
          acquisitionId: existing.txHash,
          retryAfterMs: this.pendingRetryAfterMs(),
          message: "Resource acquisition still in progress",
          detail: { reason: "acquisition_in_flight" },
        });
      }
    }

    const energyTarget = this.resolveEnergyTarget(req.hints);
    const onChainEnergy = await this.readEnergyRemaining(address).catch(
      () => null,
    );
    if (onChainEnergy != null && onChainEnergy >= energyTarget) {
      const ref = existing?.txHash ?? `sufficient:${address}`;
      await this.upsertSponsorship({
        address,
        purpose,
        status: "sent",
        provider: "on-chain-sufficient",
        amountRaw: "0",
        txHash: ref,
        errorMessage: null,
      });
      return resourceResult({
        status: ResourceStatus.ALREADY_AVAILABLE,
        network: "tron",
        address,
        provider: "on-chain-sufficient",
        acquisitionId: ref,
        message: "On-chain resources already sufficient",
        detail: { energyRemaining: onChainEnergy, energyTarget },
      });
    }

    const resources = this.platformConfig.getResources();
    const mode = String(
      this.configService.get(SETTING_KEYS.TRON_ENERGY_PROVIDER) ??
        resources.tronEnergyProvider,
    )
      .trim()
      .toLowerCase();
    if (mode === "off" || mode === "disabled" || mode === "none") {
      return resourceResult({
        status: ResourceStatus.PROVIDER_UNAVAILABLE,
        network: "tron",
        address,
        provider: this.name,
        message: "TRON energy provider mode is off",
      });
    }

    try {
      const acquired =
        mode === "http" || (mode === "auto" && this.httpConfigured())
          ? await this.acquireViaHttp(address, energyTarget, req.hints)
          : await this.acquireViaSelfDelegate(address, energyTarget);

      const acquisitionId = acquired.txid ?? `delegated:${Date.now()}`;
      // Fresh acquisitions are PENDING until verify confirms usable energy.
      await this.upsertSponsorship({
        address,
        purpose,
        status: "pending",
        provider: acquired.provider,
        amountRaw: acquired.amountRaw,
        txHash: acquisitionId,
        errorMessage: null,
      });

      this.logger.log(
        `TRON acquire PENDING provider=${acquired.provider} ref=${acquisitionId}`,
      );

      return resourceResult({
        status: ResourceStatus.PENDING,
        network: "tron",
        address,
        provider: acquired.provider,
        acquisitionId,
        retryAfterMs: this.pendingRetryAfterMs(),
        message: "Resource acquisition accepted; waiting until usable",
        detail: {
          amountRaw: acquired.amountRaw,
          energyTarget,
          async: acquired.async,
        },
      });
    } catch (err) {
      let message = getErrorMessage(err);
      message = decodePossiblyHex(message);
      this.logger.error(`TRON acquire failed address=${address}: ${message}`);

      await this.upsertSponsorship({
        address,
        purpose,
        status: "failed",
        provider: mode === "http" ? "tron-http" : "tron-self",
        amountRaw: null,
        txHash: null,
        errorMessage: message.slice(0, 500),
        ttlMs: 60_000,
      }).catch(() => undefined);

      return resourceResult({
        status: this.mapErrorStatus(message),
        network: "tron",
        address,
        provider: this.name,
        message,
      });
    }
  }

  async verify(req: ResourceRequirement): Promise<ResourceResult> {
    const address = req.address.trim();

    if (!TRON_ADDRESS_RE.test(address)) {
      return resourceResult({
        status: ResourceStatus.FAILED,
        network: "tron",
        address,
        provider: this.name,
        message: "Invalid TRON address",
      });
    }

    if (!this.isEnabled()) {
      return resourceResult({
        status: ResourceStatus.PROVIDER_UNAVAILABLE,
        network: "tron",
        address,
        provider: this.name,
        message: "Resource sponsorship disabled",
        detail: { reason: "sponsorship_disabled" },
      });
    }

    const energyTarget = this.resolveEnergyTarget(req.hints);
    const energyRemaining = await this.readEnergyRemaining(address).catch(
      () => 0,
    );
    const resources = await this.readAccountResources(address).catch(() => ({
      freeNetRemaining: 0,
      balanceSun: 0,
    }));

    const hasEnergy = energyRemaining >= Math.min(energyTarget, 1);
    const hasNativeFee =
      resources.balanceSun > 0 || resources.freeNetRemaining > 0;
    const ready = hasEnergy || hasNativeFee;

    this.logger.log(
      `TRON verify address=${address} energy=${energyRemaining} target=${energyTarget} ready=${ready}`,
    );

    if (ready) {
      // Promote in-flight acquisition to usable.
      const existing = await this.findSponsorship(
        address,
        req.purpose || "approve",
      );
      if (existing?.status === "pending") {
        await this.upsertSponsorship({
          address,
          purpose: req.purpose || "approve",
          status: "sent",
          provider: existing.provider || this.name,
          amountRaw: existing.amountRaw,
          txHash: existing.txHash ?? `verified:${address}`,
          errorMessage: null,
        }).catch(() => undefined);
      }

      return resourceResult({
        status: ResourceStatus.READY,
        network: "tron",
        address,
        provider: this.name,
        message: "Resources ready for broadcast",
        acquisitionId: existing?.txHash ?? null,
        detail: {
          energyRemaining,
          energyTarget,
          freeNetRemaining: resources.freeNetRemaining,
          balanceSun: resources.balanceSun,
        },
      });
    }

    const pending = await this.findSponsorship(
      address,
      req.purpose || "approve",
    );
    if (pending?.status === "pending") {
      return resourceResult({
        status: ResourceStatus.PENDING,
        network: "tron",
        address,
        provider: pending.provider || this.name,
        acquisitionId: pending.txHash,
        retryAfterMs: this.pendingRetryAfterMs(),
        message: "Resources not usable yet; acquisition still propagating",
        detail: {
          energyRemaining,
          energyTarget,
          freeNetRemaining: resources.freeNetRemaining,
          balanceSun: resources.balanceSun,
        },
      });
    }

    return resourceResult({
      status: ResourceStatus.INSUFFICIENT_RESOURCES,
      network: "tron",
      address,
      provider: this.name,
      message: "Account lacks energy/bandwidth/TRX for broadcast",
      detail: {
        energyRemaining,
        energyTarget,
        freeNetRemaining: resources.freeNetRemaining,
        balanceSun: resources.balanceSun,
      },
    });
  }

  // ── TRON internals ──────────────────────────────────────────────

  private isEnabled(): boolean {
    return Boolean(
      this.configService.get(SETTING_KEYS.RESOURCE_SPONSOR_ENABLED),
    );
  }

  private httpConfigured(): boolean {
    return Boolean(this.platformConfig.getResources().tronEnergyHttpUrl);
  }

  private resolveEnergyTarget(hints?: Record<string, unknown>): number {
    const fromHint = Number(hints?.energyTarget ?? hints?.estimatedEnergy ?? 0);
    if (Number.isFinite(fromHint) && fromHint > 0) return Math.floor(fromHint);
    const target = Number(
      this.configService.get(SETTING_KEYS.TRON_ENERGY_TARGET),
    );
    return Math.max(
      1,
      target || this.platformConfig.getResources().tronEnergyTarget,
    );
  }

  private mapErrorStatus(message: string): ResourceStatusType {
    const lower = message.toLowerCase();
    if (
      /insufficient|delegat|freeze|resource|bandwidth|energy|balance|not enough/i.test(
        lower,
      )
    ) {
      return ResourceStatus.INSUFFICIENT_RESOURCES;
    }
    if (/timeout|network|fetch|econn|not configured|unavailable/i.test(lower)) {
      return ResourceStatus.PROVIDER_UNAVAILABLE;
    }
    return ResourceStatus.FAILED;
  }

  private pendingRetryAfterMs(): number {
    return this.platformConfig.getResources().tronEnergyPendingRetryMs;
  }

  private async acquireViaSelfDelegate(
    address: string,
    energyTarget: number,
  ): Promise<{
    provider: string;
    txid: string | null;
    amountRaw: string;
    async: boolean;
  }> {
    const pk = this.delegatorPrivateKey();
    if (!pk) {
      throw new Error("TRON energy delegator private key is not configured");
    }

    const tron = new TronWeb({
      fullHost: this.tronFullHost(),
      headers: this.tronHeaders(),
      privateKey: pk,
    });
    const from = tron.address.fromPrivateKey(pk);
    if (!from || typeof from !== "string") {
      throw new Error("Energy delegator private key is invalid");
    }
    if (from === address) {
      throw new Error("Cannot delegate energy to the delegator address itself");
    }

    await this.assertDelegatorActivated(from);

    const sunOverride =
      this.platformConfig.getResources().tronEnergyDelegateSun;
    const amountSun =
      sunOverride > 0
        ? Math.floor(sunOverride)
        : await this.energyToSun(energyTarget, address, from);

    if (amountSun <= 0) throw new Error("Computed delegation amount is zero");

    this.logger.log(
      `TRON delegateResource sun=${amountSun} from=${from} to=${address}`,
    );

    const unsigned = await tron.transactionBuilder.delegateResource(
      amountSun,
      address,
      "ENERGY",
      from,
      false,
    );
    const signed = await tron.trx.sign(unsigned, pk);
    const broadcast = (await tron.trx.sendRawTransaction(
      signed,
    )) as unknown as {
      result?: boolean;
      txid?: string;
      transaction?: { txID?: string };
      code?: string | number;
      message?: string;
    };

    if (!broadcast?.result) {
      const raw =
        typeof broadcast?.message === "string"
          ? broadcast.message
          : broadcast?.code != null
            ? String(broadcast.code)
            : "delegateResource broadcast rejected";
      throw new Error(decodePossiblyHex(String(raw)));
    }

    const txid =
      broadcast.txid ||
      broadcast.transaction?.txID ||
      (typeof (signed as { txID?: string }).txID === "string"
        ? (signed as { txID: string }).txID
        : null);

    return {
      provider: "tron-self",
      txid,
      amountRaw: String(amountSun),
      // Broadcast accepted; energy may take a few blocks to appear.
      async: true,
    };
  }

  private async acquireViaHttp(
    address: string,
    energyTarget: number,
    hints?: Record<string, unknown>,
  ): Promise<{
    provider: string;
    txid: string | null;
    amountRaw: string;
    async: boolean;
  }> {
    const resources = this.platformConfig.getResources();
    const url = resources.tronEnergyHttpUrl;
    if (!url)
      throw new Error("TRON HTTP energy provider URL is not configured");

    const apiKey = resources.tronEnergyHttpApiKey;
    const addressField =
      resources.tronEnergyHttpAddressField || "destinationAddress";

    const body: Record<string, unknown> = {
      [addressField]: address,
      energyAmount: energyTarget,
      energy: energyTarget,
      currentUsdt: String(hints?.currentUsdt ?? "0"),
      period: resources.tronEnergyHttpPeriod,
      feeLimit: hints?.feeLimit,
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(
        Math.max(5_000, resources.tronEnergyHttpTimeoutMs),
      ),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(
        `Energy HTTP provider returned non-JSON (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    if (!res.ok || json.ok === false || json.success === false) {
      throw new Error(
        String(json.error || json.message || `HTTP ${res.status}`),
      );
    }

    const txHash =
      (typeof json.txid === "string" && json.txid) ||
      (typeof json.tx === "string" && json.tx) ||
      (typeof json.txHash === "string" && json.txHash) ||
      null;
    const orderId = typeof json.orderId === "string" ? json.orderId : null;

    return {
      provider: "tron-http",
      txid: txHash || orderId,
      amountRaw: String(energyTarget),
      // HTTP rentals are typically async until energy lands on-chain.
      async: true,
    };
  }

  private async assertDelegatorActivated(delegator: string): Promise<void> {
    const res = await fetch(`${this.tronFullHost()}/v1/accounts/${delegator}`, {
      headers: this.tronHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: unknown[];
    };
    if (!Array.isArray(json.data) || json.data.length === 0) {
      throw new Error(
        `Energy delegator ${delegator} is not activated on TRON; fund the wallet and freeze TRX for ENERGY before sponsoring approvals`,
      );
    }
  }

  /**
   * Network-wide energy weights are included in getaccountresource for any
   * activated account. Unactivated delegators return {} — try recipient and
   * known contracts before failing.
   */
  private async readNetworkEnergyWeights(
    ...candidateAddresses: string[]
  ): Promise<{ totalEnergyLimit: number; totalEnergyWeight: number }> {
    const seen = new Set<string>();
    for (const address of candidateAddresses) {
      const trimmed = address.trim();
      if (!trimmed || !TRON_ADDRESS_RE.test(trimmed) || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      try {
        const res = await fetch(
          `${this.tronFullHost()}/wallet/getaccountresource`,
          {
            method: "POST",
            headers: this.tronHeaders(),
            body: JSON.stringify({ address: trimmed, visible: true }),
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          },
        );
        const json = (await res.json().catch(() => ({}))) as {
          TotalEnergyLimit?: number;
          TotalEnergyWeight?: number;
        };
        const { totalEnergyLimit, totalEnergyWeight } =
          parseNetworkEnergyWeights(json);
        if (totalEnergyLimit > 0 && totalEnergyWeight > 0) {
          return { totalEnergyLimit, totalEnergyWeight };
        }
      } catch {
        // try next candidate
      }
    }
    throw new Error(
      "Unable to read network energy weights; cannot size delegation",
    );
  }

  private async energyToSun(
    energyTarget: number,
    recipient: string,
    delegator: string,
  ): Promise<number> {
    const { totalEnergyLimit, totalEnergyWeight } =
      await this.readNetworkEnergyWeights(
        recipient,
        delegator,
        TRON_NETWORK_WEIGHT_FALLBACK_ADDRESS,
      );
    return energyTargetToDelegateSun(
      energyTarget,
      totalEnergyLimit,
      totalEnergyWeight,
    );
  }

  private async readEnergyRemaining(address: string): Promise<number> {
    const res = await fetch(
      `${this.tronFullHost()}/wallet/getaccountresource`,
      {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({ address, visible: true }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      EnergyLimit?: number;
      EnergyUsed?: number;
    };
    return Math.max(
      0,
      Number(json.EnergyLimit ?? 0) - Number(json.EnergyUsed ?? 0),
    );
  }

  private async readAccountResources(address: string): Promise<{
    freeNetRemaining: number;
    balanceSun: number;
  }> {
    const [resourceRes, acctRes] = await Promise.all([
      fetch(`${this.tronFullHost()}/wallet/getaccountresource`, {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({ address, visible: true }),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      }),
      fetch(`${this.tronFullHost()}/v1/accounts/${address}`, {
        headers: this.tronHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      }),
    ]);
    const resourceJson = (await resourceRes.json().catch(() => ({}))) as {
      freeNetLimit?: number;
      freeNetUsed?: number;
      NetLimit?: number;
      NetUsed?: number;
    };
    const acctJson = (await acctRes.json().catch(() => ({}))) as {
      data?: Array<{ balance?: number }>;
    };
    const freeNetRemaining = Math.max(
      0,
      Number(resourceJson.freeNetLimit ?? 0) -
        Number(resourceJson.freeNetUsed ?? 0) +
        (Number(resourceJson.NetLimit ?? 0) -
          Number(resourceJson.NetUsed ?? 0)),
    );
    return {
      freeNetRemaining,
      balanceSun: Number(acctJson.data?.[0]?.balance ?? 0),
    };
  }

  private ttlMs(): number {
    const hours = Number(
      this.configService.get(SETTING_KEYS.TRON_ENERGY_IDEMPOTENCY_HOURS),
    );
    const fallback =
      this.platformConfig.getResources().tronEnergyIdempotencyHours;
    const safe = Number.isFinite(hours) && hours > 0 ? hours : fallback;
    return Math.floor(safe * 60 * 60 * 1000);
  }

  private async findSponsorship(
    address: string,
    purpose: string,
  ): Promise<SponsorshipRow | null> {
    const rows = await prisma.$queryRawUnsafe<SponsorshipRow[]>(
      `SELECT status, provider, "amountRaw", "txHash", "expiresAt"
       FROM "ResourceSponsorship"
       WHERE network = 'tron' AND address = $1 AND resource = 'ENERGY' AND purpose = $2
       LIMIT 1`,
      address,
      purpose,
    );
    return rows[0] ?? null;
  }

  private async upsertSponsorship(args: {
    address: string;
    purpose: string;
    status: string;
    provider: string;
    amountRaw: string | null;
    txHash: string | null;
    errorMessage: string | null;
    ttlMs?: number;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + (args.ttlMs ?? this.ttlMs()));
    const id = randomUUID().replace(/-/g, "").slice(0, 24);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ResourceSponsorship"
         (id, network, address, resource, purpose, status, provider,
          "amountRaw", "txHash", "errorMessage", "expiresAt", "createdAt", "updatedAt")
       VALUES ($1,'tron',$2,'ENERGY',$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
       ON CONFLICT (network, address, resource, purpose)
       DO UPDATE SET
         status = EXCLUDED.status,
         provider = EXCLUDED.provider,
         "amountRaw" = EXCLUDED."amountRaw",
         "txHash" = EXCLUDED."txHash",
         "errorMessage" = EXCLUDED."errorMessage",
         "expiresAt" = EXCLUDED."expiresAt",
         "updatedAt" = NOW()`,
      id,
      args.address,
      args.purpose,
      args.status,
      args.provider,
      args.amountRaw,
      args.txHash,
      args.errorMessage,
      expiresAt,
    );
  }
}
