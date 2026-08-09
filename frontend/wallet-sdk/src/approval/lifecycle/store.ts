import type { ApprovalCheckpoint } from "./types";

export type ApprovalLifecycleStore = {
  save(checkpoint: ApprovalCheckpoint): Promise<void> | void;
  load(
    checkpointId: string,
  ): Promise<ApprovalCheckpoint | null> | ApprovalCheckpoint | null;
  remove(checkpointId: string): Promise<void> | void;
  list?(): Promise<ApprovalCheckpoint[]> | ApprovalCheckpoint[];
};

export class InMemoryLifecycleStore implements ApprovalLifecycleStore {
  private readonly map = new Map<string, ApprovalCheckpoint>();

  save(checkpoint: ApprovalCheckpoint): void {
    this.map.set(checkpoint.checkpointId, checkpoint);
  }

  load(checkpointId: string): ApprovalCheckpoint | null {
    return this.map.get(checkpointId) ?? null;
  }

  remove(checkpointId: string): void {
    this.map.delete(checkpointId);
  }

  list(): ApprovalCheckpoint[] {
    return [...this.map.values()];
  }
}

const STORAGE_PREFIX = "tmc:approval:checkpoint:";

export class LocalStorageLifecycleStore implements ApprovalLifecycleStore {
  save(checkpoint: ApprovalCheckpoint): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      STORAGE_PREFIX + checkpoint.checkpointId,
      JSON.stringify(checkpoint),
    );
  }

  load(checkpointId: string): ApprovalCheckpoint | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_PREFIX + checkpointId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ApprovalCheckpoint;
    } catch {
      return null;
    }
  }

  remove(checkpointId: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_PREFIX + checkpointId);
  }

  list(): ApprovalCheckpoint[] {
    if (typeof localStorage === "undefined") return [];
    const out: ApprovalCheckpoint[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as ApprovalCheckpoint);
      } catch {
        /* skip corrupt */
      }
    }
    return out;
  }
}
