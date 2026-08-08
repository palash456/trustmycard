import { createRequire } from "module";
import { resolve } from "path";

const nodeRequire = createRequire(__filename);
const { loadTmcEnv } = nodeRequire(
  resolve(__dirname, "../../../config/load-env.mjs")
) as { loadTmcEnv: (app: "backend" | "website" | "admin") => string };

const tmcEnv = loadTmcEnv("backend");
console.log(`[trustmycard] TMC_ENV=${tmcEnv}`);

function assertProductionInfraEnv(): void {
  if (tmcEnv !== "production" && tmcEnv !== "production-preview") return;

  const missing: string[] = [];
  if (!(process.env.DATABASE_URL ?? "").trim()) missing.push("DATABASE_URL");
  if (!(process.env.REDIS_URL ?? "").trim()) missing.push("REDIS_URL");

  if (missing.length === 0) return;

  throw new Error(
    `[trustmycard] Missing required infrastructure env for ${tmcEnv}: ${missing.join(", ")}. ` +
      "On Render, set DATABASE_URL (Neon) and REDIS_URL (Upstash) on the tmc-backend service."
  );
}

assertProductionInfraEnv();
