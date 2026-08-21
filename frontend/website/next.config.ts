import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
const nodeRequire = createRequire(import.meta.url);
const { loadTmcEnv } = nodeRequire(
  path.join(repoRoot, "config/load-env.mjs"),
) as { loadTmcEnv: (app: "backend" | "website" | "admin") => string };
const { eligibilityEnvFromProcess } = nodeRequire(
  path.join(repoRoot, "config/eligibility-env.mjs"),
) as { eligibilityEnvFromProcess: () => Record<string, string> };

loadTmcEnv("website");
const eligibilityEnv = eligibilityEnvFromProcess();

const frontendRoot = path.join(configDir, "..");

const isProductionBuild = process.env.NODE_ENV === "production";

function detectLanDevOrigins(): string[] {
  const origins = new Set<string>();
  const fromEnv = process.env.TMC_LAN_DEV_ORIGIN?.trim();
  if (fromEnv) origins.add(fromEnv);

  if (process.platform === "darwin") {
    for (const iface of ["en0", "en1"]) {
      try {
        const ip = execSync(`ipconfig getifaddr ${iface}`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (ip) origins.add(ip);
      } catch {
        // interface unavailable
      }
    }
  }

  return [...origins];
}

const lanDevOrigins = !isProductionBuild ? detectLanDevOrigins() : [];

const nextConfig: NextConfig = {
  env: eligibilityEnv,
  output: "standalone",
  transpilePackages: ["@trustmycard/wallet-sdk", "@trustmycard/shared"],
  outputFileTracingRoot: frontendRoot,
  // Monorepo has lockfiles at repo root and frontend/ — pin Turbopack to the workspace.
  turbopack: {
    root: frontendRoot,
  },
  ...(lanDevOrigins.length > 0 ? { allowedDevOrigins: lanDevOrigins } : {}),
  compiler: isProductionBuild ? { removeConsole: true } : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/logos/optimized/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
