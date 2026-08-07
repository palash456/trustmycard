import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
const nodeRequire = createRequire(import.meta.url);
const { loadTmcEnv } = nodeRequire(
  path.join(repoRoot, "config/load-env.mjs")
) as { loadTmcEnv: (app: string) => string };

loadTmcEnv("marketing");

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
