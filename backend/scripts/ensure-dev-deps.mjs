#!/usr/bin/env node
/**
 * LOCAL DEVELOPMENT ONLY — native Postgres + Redis on the host.
 *
 * Not used in production builds, Docker images, Render, or VPS deploy.
 * Hooked only via: prestart:dev, prestart:workers:dev, dev:deps.
 *
 * Production uses start:prod / container runtime (TMC_ENV=production).
 * Docker Compose in deploy/ is for production pipeline & deploy validation only.
 */
import net from "net";
import { loadTmcEnv } from "../../config/load-env.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const SETUP_HINT =
  "From repo root: ./scripts/local-dev-setup.sh — or see backend/README.md";

function log(message) {
  console.log(`[trustmycard] ${message}`);
}

function warn(message) {
  console.warn(`[trustmycard] ${message}`);
}

function error(message) {
  console.error(`[trustmycard] ${message}`);
}

function parsePostgresEndpoint(databaseUrl) {
  const raw = (databaseUrl ?? "").trim();
  if (!raw) return { host: "localhost", port: 5432 };

  const withoutScheme = raw.replace(/^postgres(?:ql)?:\/\//, "");
  const hostPart = withoutScheme.split("/")[0] ?? "";
  const at = hostPart.lastIndexOf("@");
  const hostPort = at >= 0 ? hostPart.slice(at + 1) : hostPart;
  const [host, portStr] = hostPort.split(":");
  return {
    host: host || "localhost",
    port: Number(portStr || 5432),
  };
}

function parseRedisEndpoint(redisUrl) {
  const raw = (redisUrl ?? "").trim();
  if (!raw) return { host: "127.0.0.1", port: 6379 };

  try {
    const parsed = new URL(raw);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port || 6379),
    };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

function probeTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    const finish = (ok) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(ok);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function waitForTcp(host, port, label, maxWaitMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await probeTcp(host, port)) {
      log(`${label} ready at ${host}:${port}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function isLocalEndpoint(host) {
  return LOCAL_HOSTS.has(host.toLowerCase());
}

function isAllowedDevContext(tmcEnv) {
  if (tmcEnv !== "development") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

async function checkService(label, host, port) {
  if (await probeTcp(host, port)) {
    log(`${label} reachable at ${host}:${port}`);
    return true;
  }

  warn(`${label} not reachable at ${host}:${port}`);

  if (!isLocalEndpoint(host)) {
    error(
      `${label} uses remote host ${host}:${port} — start that service or point env to local hosts for native dev.`,
    );
    return false;
  }

  return await waitForTcp(host, port, label);
}

async function main() {
  if (process.env.TMC_SKIP_DEV_DEPS === "1") {
    log("TMC_SKIP_DEV_DEPS=1 — skipping dependency check");
    return;
  }

  const tmcEnv = loadTmcEnv("backend");

  if (!isAllowedDevContext(tmcEnv)) {
    return;
  }

  log("Checking native dev dependencies (Postgres + Redis on localhost)…");

  const pg = parsePostgresEndpoint(process.env.DATABASE_URL);
  const redis = parseRedisEndpoint(process.env.REDIS_URL);

  const postgresOk = await checkService("PostgreSQL", pg.host, pg.port);
  const redisOk = await checkService("Redis", redis.host, redis.port);

  if (!postgresOk || !redisOk) {
    error("Native dev dependencies are not ready.");
    if (!postgresOk) {
      error(
        `  PostgreSQL: ${pg.host}:${pg.port} (DATABASE_URL) — API uses PORT=${process.env.PORT ?? "4000"} when up`,
      );
    }
    if (!redisOk) {
      error(`  Redis: ${redis.host}:${redis.port} (REDIS_URL)`);
    }
    error(`  ${SETUP_HINT}`);
    process.exit(1);
  }

  log(
    `Native dev dependencies OK — API will listen on PORT=${process.env.PORT ?? "4000"}`,
  );
}

await main();
