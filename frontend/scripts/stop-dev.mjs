/**
 * Stop dev servers by port and clear stale Next.js lock files.
 * Usage: node scripts/stop-dev.mjs <website|admin|backend|all>
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Fixed dev ports — keep backend off 3001 so website fallback never collides. */
export const DEV_PORTS = {
  website: 3000,
  admin: 3002,
  backend: 4000,
};

const APPS = {
  website: { port: DEV_PORTS.website, dir: join(FRONTEND_ROOT, "website"), next: true },
  admin: { port: DEV_PORTS.admin, dir: join(FRONTEND_ROOT, "admin"), next: true },
  backend: { port: DEV_PORTS.backend, dir: join(FRONTEND_ROOT, "../backend"), next: false },
};

function killPort(port) {
  if (process.platform === "win32") {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (/^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          console.log(`[stop-dev] killed PID ${pid} on port ${port}`);
        } catch {
          // already gone
        }
      }
    } catch {
      // nothing listening
    }
    return;
  }

  try {
    execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: "ignore", shell: true });
    console.log(`[stop-dev] cleared port ${port}`);
  } catch {
    // nothing listening
  }
}

function clearNextDevState(dir) {
  const lock = join(dir, ".next", "dev", "lock");
  if (existsSync(lock)) {
    rmSync(lock, { force: true });
    console.log(`[stop-dev] removed stale Next lock (${dir})`);
  }
}

const target = process.argv[2];
if (!target || !(target === "all" || APPS[target])) {
  console.error("Usage: node scripts/stop-dev.mjs <website|admin|backend|all>");
  process.exit(1);
}

const names = target === "all" ? Object.keys(APPS) : [target];
for (const name of names) {
  const app = APPS[name];
  killPort(app.port);
  if (app.next) clearNextDevState(app.dir);
}

console.log(`[stop-dev] done (${names.join(", ")})`);
