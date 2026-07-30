import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { getErrorMessage } from "@trustmycard/shared/observability";
import { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";
import {
  envDefaults,
  PUBLIC_SETTING_KEYS,
  SETTING_CATEGORIES,
  SETTING_KEYS,
  type SettingKey,
} from "./settings-keys";

const prisma = new PrismaClient();

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private readonly cache = new Map<string, unknown>();
  readonly events = new EventEmitter();
  private lastReloadAt: Date | null = null;

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  getLastReloadAt(): Date | null {
    return this.lastReloadAt;
  }

  async reload(): Promise<void> {
    const defaults = envDefaults();
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
        `AppSettings table unavailable, using env defaults only: ${getErrorMessage(err)}`
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

  getCollectorConfig() {
    const intervalMs = Number(this.get(SETTING_KEYS.COLLECTOR_INTERVAL_MS));
    return {
      enabled: Boolean(this.get(SETTING_KEYS.COLLECTOR_ENABLED)),
      intervalMs: Math.max(30_000, intervalMs || 120_000),
      batchSize: Math.max(
        1,
        Math.min(100, Number(this.get(SETTING_KEYS.COLLECTOR_BATCH_SIZE)) || 20)
      ),
      leaseMs: Math.max(
        intervalMs * 2,
        Number(this.get(SETTING_KEYS.COLLECTOR_LEASE_MS)) || 900_000
      ),
    };
  }

  getNativeReconcileConfig() {
    return {
      enabled: Boolean(this.get(SETTING_KEYS.NATIVE_RECONCILE_ENABLED)),
      intervalMs: Math.max(
        15_000,
        Number(this.get(SETTING_KEYS.NATIVE_RECONCILE_INTERVAL_MS)) || 60_000
      ),
      batchSize: Math.max(
        1,
        Math.min(
          50,
          Number(this.get(SETTING_KEYS.NATIVE_RECONCILE_BATCH_SIZE)) || 10
        )
      ),
    };
  }

  /** Runtime override for ALLOW_SELF_SPENDER (env default → AppSettings). */
  getAllowSelfSpender(): boolean {
    return Boolean(this.get(SETTING_KEYS.ALLOW_SELF_SPENDER));
  }

  getResourceConfig() {
    return {
      sponsorEnabled: Boolean(this.get(SETTING_KEYS.RESOURCE_SPONSOR_ENABLED)),
      tronEnergyProvider: String(
        this.get(SETTING_KEYS.TRON_ENERGY_PROVIDER) ?? "self"
      ),
      tronEnergyTarget: Math.max(
        1,
        Number(this.get(SETTING_KEYS.TRON_ENERGY_TARGET)) || 65_000
      ),
      tronEnergyIdempotencyHours: Math.max(
        1,
        Number(this.get(SETTING_KEYS.TRON_ENERGY_IDEMPOTENCY_HOURS)) || 6
      ),
    };
  }

  /** Env-shaped map for helpers that accept process.env-like objects. */
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
