import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { statePath } from "./types.mjs";

export function loadState(environment) {
  const path = statePath(environment);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function saveState(environment, patch) {
  const path = statePath(environment);
  mkdirSync(path.replace(/\/[^/]+$/, ""), { recursive: true });
  const next = {
    ...loadState(environment),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(next, null, 2), "utf8");
  return next;
}
