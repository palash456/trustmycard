import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Load backend env files before Prisma / Nest bootstrap.
 * Matches local dev convention: `.env` base, `.env.local` overrides.
 */
const root = process.cwd();

for (const name of [".env", ".env.local"]) {
  const path = resolve(root, name);
  if (existsSync(path)) {
    config({ path, override: name === ".env.local" });
  }
}
