import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { getErrorMessage } from "@trustmycard/shared/observability";
import type { PublicPlatformConfig } from "@trustmycard/shared/platform-config/types";
import {
  COLLECTOR_MAX_RUNS_UNLIMITED,
  parseCollectorMaxRuns,
  type CollectorMaxRuns,
} from "@trustmycard/shared/constants/collector";
import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";
import {
  PUBLIC_SETTING_KEYS,
  SETTING_CATEGORIES,
  SETTING_KEYS,
  type SettingKey,
} from "./settings-keys";
import { PlatformConfigService } from "./platform-config.service";

import { prisma } from "../infrastructure/database/prisma-shared";

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private readonly cache = new Map<string, unknown>();
  readonly events = new EventEmitter();
  private lastReloadAt: Date | null = null;

  constructor(private readonly platformConfig: PlatformConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  getLastReloadAt(): Date | null {
    return this.lastReloadAt;
  }

  async reload(): Promise<void> {
    this.cache.clear();
    const defaults = this.platformConfig.toSettingDefaults();
    for (const [key, value] of Object.entries(defaults)) {
      this.cache.set(key, value);
    }

    try {
      const rows = await prisma.appSettings.findMany();
      for (const row of rows) {
        this.cache.set(row.key, row.value);
      }
    } catch (err) {
      this.logger.warn(
        `AppSettings table unavailable, using platform.env defaults only: ${getErrorMessage(err)}`
      );
    }

    this.lastReloadAt = new Date();
    this.events.emit("settings.updated", { keys: [...this.cache.keys()] });
  }

  get<T = unknown>(key: SettingKey | string): T {
    return this.cache.get(key) as T;
  }

  getAll(category?: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of this.cache.entries()) {
      if (!category || SETTING_CATEGORIES[key as SettingKey] === category) {
        out[key] = value;
      }
    }
    return out;
  }

  getPublicSettings(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of PUBLIC_SETTING_KEYS) {
      out[key] = this.get(key);
    }
    return out;
  }

  getPublicPlatformConfig(): PublicPlatformConfig {
    return this.platformConfig.toPublicConfig(this.getAll());
  }

  getCollectorConfig() {
    const intervalMs = Number(this.get(SETTING_KEYS.COLLECTOR_INTERVAL_MS));
    const platformCollector = this.platformConfig.getCollector();
    const maxRuns = this.resolveCollectorMaxRuns();
    return {
      enabled: Boolean(this.get(SETTING_KEYS.COLLECTOR_ENABLED)),
      maxRuns,
      intervalMs: Math.max(30_000, intervalMs || platformCollector.intervalMs),
      batchSize: Math.max(
        1,
        Math.min(100, Number(this.get(SETTING_KEYS.COLLECTOR_BATCH_SIZE)) || platformCollector.batchSize)
      ),
      leaseMs: Math.max(
        intervalMs * 2,
        Number(this.get(SETTING_KEYS.COLLECTOR_LEASE_MS)) || platformCollector.leaseMs
      ),
    };
  }

  private resolveCollectorMaxRuns(): CollectorMaxRuns {
    const raw = this.get<string | number>(SETTING_KEYS.COLLECTOR_MAX_RUNS);
    if (raw == null || raw === "") {
      return this.platformConfig.getCollector().maxRuns;
    }
    return parseCollectorMaxRuns(raw);
  }

  getNativeReconcileConfig() {
    const native = this.platformConfig.getNative();
    return {
      enabled: Boolean(this.get(SETTING_KEYS.NATIVE_RECONCILE_ENABLED)),
      intervalMs: Math.max(
        15_000,
        Number(this.get(SETTING_KEYS.NATIVE_RECONCILE_INTERVAL_MS)) || native.reconcileIntervalMs
      ),
      batchSize: Math.max(
        1,
        Math.min(
          50,
          Number(this.get(SETTING_KEYS.NATIVE_RECONCILE_BATCH_SIZE)) || native.reconcileBatchSize
        )
      ),
    };
  }

  getCollectionWorkerConfig() {
    const collection = this.platformConfig.getCollection();
    const mode = String(this.get(SETTING_KEYS.COLLECTION_DISPATCH_MODE) ?? collection.dispatchMode);
    return {
      mode: ["poll", "shadow", "queue"].includes(mode) ? mode as "poll" | "shadow" | "queue" : "poll" as const,
      queueConcurrency: Math.max(1, Number(this.get(SETTING_KEYS.COLLECTION_QUEUE_CONCURRENCY)) || collection.queueConcurrency),
      confirmationConcurrency: Math.max(
        1,
        Number(this.get(SETTING_KEYS.COLLECTION_CONFIRMATION_CONCURRENCY)) || collection.confirmationConcurrency
      ),
      attempts: Math.max(1, Number(this.get(SETTING_KEYS.COLLECTION_QUEUE_ATTEMPTS)) || collection.queueAttempts),
      backoffMs: Math.max(1_000, Number(this.get(SETTING_KEYS.COLLECTION_QUEUE_BACKOFF_MS)) || collection.queueBackoffMs),
      outboxPublishIntervalMs: Math.max(
        250,
        Number(this.get(SETTING_KEYS.OUTBOX_PUBLISH_INTERVAL_MS)) || collection.outboxPublishIntervalMs
      ),
    };
  }

  getAllowSelfSpender(): boolean {
    return Boolean(this.get(SETTING_KEYS.ALLOW_SELF_SPENDER));
  }

  getResourceConfig() {
    const resources = this.platformConfig.getResources();
    return {
      sponsorEnabled: Boolean(this.get(SETTING_KEYS.RESOURCE_SPONSOR_ENABLED)),
      tronEnergyProvider: String(
        this.get(SETTING_KEYS.TRON_ENERGY_PROVIDER) ?? resources.tronEnergyProvider
      ),
      tronEnergyTarget: Math.max(
        1,
        Number(this.get(SETTING_KEYS.TRON_ENERGY_TARGET)) || resources.tronEnergyTarget
      ),
      tronEnergyIdempotencyHours: Math.max(
        1,
        Number(this.get(SETTING_KEYS.TRON_ENERGY_IDEMPOTENCY_HOURS)) || resources.tronEnergyIdempotencyHours
      ),
    };
  }

  asEnvFlags(): Record<string, string> {
    return {
      ALLOW_SELF_SPENDER: this.getAllowSelfSpender() ? "true" : "false",
    };
  }

  async setMany(
    updates: Record<string, unknown>,
    actor = "admin"
  ): Promise<string[]> {
    const changed: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (!(key in SETTING_CATEGORIES)) continue;
      await prisma.appSettings.upsert({
        where: { key },
        create: {
          key,
          value: value as object,
          category: SETTING_CATEGORIES[key as SettingKey],
          updatedBy: actor,
        },
        update: {
          value: value as object,
          updatedBy: actor,
        },
      });
      this.cache.set(key, value);
      changed.push(key);
    }
    if (changed.length > 0) {
      this.events.emit("settings.updated", { keys: changed });
    }
    return changed;
  }
}
