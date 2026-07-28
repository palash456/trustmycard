import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(configDir, "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@trustmycard/wallet-sdk"],
  outputFileTracingRoot: frontendRoot,
};

export default nextConfig;
