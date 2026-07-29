import { Injectable, OnModuleInit } from "@nestjs/common";
import { EventEmitter } from "events";
import { ConfigService } from "../../config/config.service";

export type AdminStreamEvent = {
  type: string;
  payload: unknown;
  at: string;
};

@Injectable()
export class AdminStreamService implements OnModuleInit {
  readonly bus = new EventEmitter();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.configService.events.on("settings.updated", (payload) => {
      this.emit("settings.updated", payload);
    });
    this.heartbeat = setInterval(() => {
      this.emit("heartbeat", { ok: true });
    }, 25_000);
    this.heartbeat.unref();
  }

  emit(type: string, payload: unknown): void {
    const event: AdminStreamEvent = {
      type,
      payload,
      at: new Date().toISOString(),
    };
    this.bus.emit("event", event);
  }

  subscribe(listener: (event: AdminStreamEvent) => void): () => void {
    this.bus.on("event", listener);
    return () => this.bus.off("event", listener);
  }
}
