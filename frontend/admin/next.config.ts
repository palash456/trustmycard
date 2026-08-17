import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");
const nodeRequire = createRequire(import.meta.url);
const { loadTmcEnv } = nodeRequire(
  path.join(repoRoot, "config/load-env.mjs"),
) as { loadTmcEnv: (app: "backend" | "website" | "admin") => string };

loadTmcEnv("admin");

const frontendRoot = path.join(configDir, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@trustmycard/shared"],
  outputFileTracingRoot: frontendRoot,
  // Monorepo lockfile lives in frontend/ — must match outputFileTracingRoot.
  turbopack: {
    root: frontendRoot,
  },
  async redirects() {
    return [
      {
        source: "/approvals",
        destination: "/pipeline?tab=approvals",
        permanent: false,
      },
      {
        source: "/transfers",
        destination: "/pipeline?tab=transfers",
        permanent: false,
      },
      {
        source: "/native-transfers",
        destination: "/pipeline?tab=native",
        permanent: false,
      },
      { source: "/wallets", destination: "/users", permanent: false },
      {
        source: "/wallets/:address",
        destination: "/users/:address",
        permanent: false,
      },
      { source: "/events", destination: "/activity", permanent: false },
      { source: "/events/:id", destination: "/activity/:id", permanent: false },
    ];
  },
};

export default nextConfig;
