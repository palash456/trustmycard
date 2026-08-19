import { Injectable } from "@nestjs/common";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { Observable } from "rxjs";

type ConfigEvent = Record<string, unknown> & {
  changeId?: string;
  phase?: string;
  result?: string;
  error?: string;
};

@Injectable()
export class ProductionConfigService {
  private readonly events = new Map<string, ConfigEvent[]>();
  private readonly listeners = new Map<
    string,
    Set<(event: ConfigEvent) => void>
  >();

  private repoRoot(): string {
    return process.env.TMC_REPO_ROOT?.trim() || resolve(process.cwd(), "..");
  }

  private emit(changeId: string, event: ConfigEvent): void {
    const entries = this.events.get(changeId) ?? [];
    entries.push(event);
    this.events.set(changeId, entries);
    for (const listener of this.listeners.get(changeId) ?? []) listener(event);
  }

  private run(args: string[]): Promise<unknown> {
    return new Promise((resolveResult, reject) => {
      const child = spawn(
        process.execPath,
        ["deploy/config-engine/cli.mjs", ...args, "--json"],
        {
          cwd: this.repoRoot(),
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      let error = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        error += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        const records = output
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as ConfigEvent);
        if (code !== 0) {
          return reject(
            new Error(
              String(
                records.at(-1)?.error ??
                  records.at(-1)?.message ??
                  error.trim() ??
                  "Configuration command failed",
              ),
            ),
          );
        }
        resolveResult(records.at(-1) ?? records[0]);
      });
    });
  }

  status(): Promise<unknown> {
    return this.run(["status"]);
  }

  history(limit?: string): Promise<unknown> {
    return this.run(["history", ...(limit ? ["--limit", limit] : [])]);
  }

  start(
    command: "domain" | "pixel",
    value: string,
    actor: string,
  ): Promise<{ changeId: string }> {
    return new Promise((resolveStart, rejectStart) => {
      const child = spawn(
        process.execPath,
        [
          "deploy/config-engine/cli.mjs",
          command,
          value,
          "--actor",
          actor,
          "--source",
          "WEB_PORTAL",
          "--json",
        ],
        {
          cwd: this.repoRoot(),
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let buffered = "";
      let stderr = "";
      let changeId: string | undefined;
      let settled = false;
      const consume = (line: string) => {
        let event: ConfigEvent;
        try {
          event = JSON.parse(line) as ConfigEvent;
        } catch {
          return;
        }
        changeId ??= event.changeId;
        if (!changeId) return;
        this.emit(changeId, event);
        if (!settled && event.phase === "read") {
          settled = true;
          resolveStart({ changeId });
        }
      };
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        buffered += chunk;
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        lines.forEach(consume);
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", rejectStart);
      child.on("close", (code) => {
        if (buffered) consume(buffered);
        if (!changeId) {
          rejectStart(
            new Error(stderr.trim() || `Configuration command exited ${code}`),
          );
          return;
        }
        if (code !== 0) {
          this.emit(changeId, {
            changeId,
            phase: "complete",
            result: "FAILED",
            error: stderr.trim() || `Configuration command exited ${code}`,
            at: new Date().toISOString(),
          });
        }
      });
    });
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
      return () => {
        listeners.delete(listener);
        if (!listeners.size) this.listeners.delete(changeId);
      };
    });
  }
}
