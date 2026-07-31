import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Load env before Prisma / Nest bootstrap.
 * 1. `config/platform.env` — shared spender addresses + signing keys
 * 2. `backend/.env` / `backend/.env.local` — service overrides (DATABASE_URL, …)
 */
const root = process.cwd();
const platformEnv = resolve(root, "../config/platform.env");

if (existsSync(platformEnv)) {
  config({ path: platformEnv, override: false });
}

for (const name of [".env", ".env.local"]) {
  const path = resolve(root, name);
  if (existsSync(path)) {
    config({ path, override: name === ".env.local" });
  }
}
