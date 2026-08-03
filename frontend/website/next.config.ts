import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { loadTmcEnv } = require(path.join(configDir, "../../config/load-env.mjs")) as {
  loadTmcEnv: (app: "backend" | "website" | "admin") => string;
};

loadTmcEnv("website");

const frontendRoot = path.join(configDir, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@trustmycard/wallet-sdk", "@trustmycard/shared"],
  outputFileTracingRoot: frontendRoot,
};

export default nextConfig;
