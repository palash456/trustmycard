import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
const nodeRequire = createRequire(import.meta.url);
const { loadTmcEnv } = nodeRequire(
  path.join(repoRoot, "config/load-env.mjs")
) as { loadTmcEnv: (app: "backend" | "website" | "admin") => string };

loadTmcEnv("website");

const frontendRoot = path.join(configDir, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@trustmycard/wallet-sdk", "@trustmycard/shared"],
  outputFileTracingRoot: frontendRoot,
};

export default nextConfig;
