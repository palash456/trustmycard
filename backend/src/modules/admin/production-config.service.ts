import { Injectable } from "@nestjs/common";
import { Observable } from "rxjs";
import { ConfigService } from "../../config/config.service";
import { SETTING_KEYS } from "../../config/settings-keys";
import {
  validateMetaPixelId,
  validateWebsiteDomainInput,
} from "../../config/runtime-config.validation";
import {
  appendProductionConfigAudit,
  readProductionConfigAudit,
} from "./production-config-audit";

type ConfigEvent = Record<string, unknown> & {
  changeId?: string;
  phase?: string;
  result?: string;
  error?: string;
  message?: string;
  at?: string;
};

type AuditRecord = {
  changeId: string;
  key: string;
  priorValue: string | null;
  requestedValue: string | null;
  finalValue: string | null;
  actor: string;
  source: string;
  startedAt: string;
  completedAt: string;
  phase: string;
  result: string;
  events: ConfigEvent[];
  error: string | null;
};

@Injectable()
export class ProductionConfigService {
  private readonly events = new Map<string, ConfigEvent[]>();
  private readonly listeners = new Map<
    string,
    Set<(event: ConfigEvent) => void>
  >();

  constructor(private readonly config: ConfigService) {}

  private emit(changeId: string, event: ConfigEvent): void {
    const entries = this.events.get(changeId) ?? [];
    entries.push(event);
    this.events.set(changeId, entries);
    for (const listener of this.listeners.get(changeId) ?? []) listener(event);
  }

  private allocateChangeId(): string {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    return `CFG-${stamp}`;
  }

  private dbSettingValue(key: string): string | null {
    const raw = this.config.get<string>(key);
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (raw != null && String(raw).trim()) return String(raw).trim();
    return null;
  }

  async status(): Promise<unknown> {
    const pixelMeta = await this.config.getRuntimeSettingMeta(
      SETTING_KEYS.META_PIXEL_ID,
    );
    const domainMeta = await this.config.getRuntimeSettingMeta(
      SETTING_KEYS.WEBSITE_DOMAIN,
    );
    const dbPixel = this.dbSettingValue(SETTING_KEYS.META_PIXEL_ID);
    const dbDomain = this.dbSettingValue(SETTING_KEYS.WEBSITE_DOMAIN);

    const metaPixelId =
      dbPixel ?? this.config.getMetaPixelId() ?? "";
    const websiteDomain =
      dbDomain ?? this.config.getWebsiteDomain() ?? "";

    const latestMeta =
      !pixelMeta && !domainMeta
        ? null
        : !domainMeta || (pixelMeta && pixelMeta.updatedAt >= domainMeta.updatedAt)
          ? pixelMeta
          : domainMeta;

    const lastSource = latestMeta ? "WEB_PORTAL" : pixelMeta || domainMeta ? "WEB_PORTAL" : "ENV_FALLBACK";

    return {
      state: {
        schemaVersion: 1,
        environment: "production",
        WEBSITE_DOMAIN: websiteDomain,
        META_PIXEL_ID: metaPixelId,
        lastChangeId: latestMeta
          ? `DB-${latestMeta.updatedAt.toISOString()}`
          : "",
        lastUpdatedAt: latestMeta?.updatedAt.toISOString() ?? null,
        lastUpdatedBy: latestMeta?.updatedBy ?? "",
        lastSource,
        source: pixelMeta || domainMeta ? "DATABASE" : "ENV_FALLBACK",
        runtimeState: {
          WEBSITE_DOMAIN: websiteDomain,
          META_PIXEL_ID: metaPixelId,
          lastUpdatedAt: latestMeta?.updatedAt.toISOString() ?? null,
          lastUpdatedBy: latestMeta?.updatedBy ?? "",
          lastSource,
        },
        deployedValues: null,
        configDrift: { WEBSITE_DOMAIN: false, META_PIXEL_ID: false },
        drift: { hasDrift: false, driftedKeys: [] },
        syncWarning: { show: false, message: "" },
      },
      platformDefaults: {
        // Meta Pixel is DB-only — never report platform.env pixel (would block admin UI).
        META_PIXEL_ID: "",
        WEBSITE_DOMAIN: process.env.WEBSITE_DOMAIN?.trim() ?? "",
      },
    };
  }

  history(limit?: string): Promise<unknown> {
    const n = Math.max(1, Math.min(100, Number(limit) || 50));
    return Promise.resolve(readProductionConfigAudit(n));
  }

  start(
    command: "domain" | "pixel",
    value: string,
    actor: string,
  ): Promise<{ changeId: string }> {
    const changeId = this.allocateChangeId();
    this.emit(changeId, {
      changeId,
      phase: "read",
      message: "Loading runtime configuration from database",
      at: new Date().toISOString(),
    });

    void this.runDatabaseUpdate(changeId, command, value, actor);

    return Promise.resolve({ changeId });
  }

  private async runDatabaseUpdate(
    changeId: string,
    command: "domain" | "pixel",
    value: string,
    actor: string,
  ): Promise<void> {
    const startedAt = new Date().toISOString();
    const key =
      command === "pixel"
        ? SETTING_KEYS.META_PIXEL_ID
        : SETTING_KEYS.WEBSITE_DOMAIN;
    const priorValue =
      command === "pixel"
        ? this.config.getMetaPixelId()
        : this.config.getWebsiteDomain();
    const audit: AuditRecord = {
      changeId,
      key,
      priorValue: priorValue ?? null,
      requestedValue: value,
      finalValue: null,
      actor,
      source: "WEB_PORTAL",
      startedAt,
      completedAt: "",
      phase: "complete",
      result: "FAILED",
      events: [],
      error: null,
    };

    const event = (
      phase: string,
      message: string,
      extra: Record<string, unknown> = {},
    ) => {
      const entry: ConfigEvent = {
        changeId,
        phase,
        message,
        at: new Date().toISOString(),
        ...extra,
      };
      audit.events.push(entry);
      this.emit(changeId, entry);
    };

    try {
      event("validation", "Validating requested configuration");
      const finalValue =
        command === "pixel"
          ? validateMetaPixelId(value)
          : validateWebsiteDomainInput(value);

      event("apply", "Writing to AppSettings (database)");
      await this.config.setRuntimeValue(key, finalValue, actor);

      audit.finalValue = finalValue;
      audit.result = "SUCCESS";
      event("complete", "SUCCESS");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Configuration update failed";
      audit.error = message;
      audit.result = "FAILED";
      event("complete", "FAILED", { error: message });
    } finally {
      audit.completedAt = new Date().toISOString();
      try {
        appendProductionConfigAudit(audit as unknown as Record<string, unknown>);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to persist audit log";
        event("log", message);
      }
    }
  }

  stream(changeId: string): Observable<{ data: string }> {
    return new Observable((subscriber) => {
      for (const event of this.events.get(changeId) ?? []) {
        subscriber.next({ data: JSON.stringify(event) });
      }
      const listener = (event: ConfigEvent) =>
        subscriber.next({ data: JSON.stringify(event) });
      const listeners = this.listeners.get(changeId) ?? new Set();
      listeners.add(listener);
      this.listeners.set(changeId, listeners);
      const heartbeat = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({
            changeId,
            phase: "heartbeat",
            at: new Date().toISOString(),
          }),
        });
      }, 20_000);
      return () => {
        clearInterval(heartbeat);
        listeners.delete(listener);
        if (!listeners.size) this.listeners.delete(changeId);
      };
    });
  }
}
