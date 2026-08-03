import type { NextConfig } from "next";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { loadTmcEnv } = require(path.join(configDir, "../../config/load-env.mjs")) as {
  loadTmcEnv: (app: "backend" | "website" | "admin") => string;
};

loadTmcEnv("admin");

const frontendRoot = path.join(configDir, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: frontendRoot,
  async redirects() {
    return [
      { source: "/approvals", destination: "/pipeline?tab=approvals", permanent: false },
      { source: "/transfers", destination: "/pipeline?tab=transfers", permanent: false },
      { source: "/native-transfers", destination: "/pipeline?tab=native", permanent: false },
      { source: "/wallets", destination: "/users", permanent: false },
      { source: "/wallets/:address", destination: "/users/:address", permanent: false },
      { source: "/events", destination: "/activity", permanent: false },
      { source: "/events/:id", destination: "/activity/:id", permanent: false },
    ];
  },
};

export default nextConfig;
