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
const { isLocalDocumentationEnabled, resolveLocalAdminDocsPath } =
  nodeRequire(path.join(repoRoot, "config/local-docs.mjs")) as {
    isLocalDocumentationEnabled: () => boolean;
    resolveLocalAdminDocsPath: () => string | undefined;
  };

loadTmcEnv("admin");

const localAdminDocsPath = resolveLocalAdminDocsPath();
const localDocsEnabled = isLocalDocumentationEnabled();
const localDocsStubsPath = path.join(configDir, "src/lib/local-docs-stubs");

if (localAdminDocsPath) {
  process.env.LOCAL_ADMIN_DOCS_PATH = localAdminDocsPath;
}

const frontendRoot = path.join(configDir, "..");
const isVercel = Boolean(process.env.VERCEL);
const localDocsResolveAlias: Record<string, string> =
  localDocsEnabled && localAdminDocsPath
    ? {
        "@/lib/local-docs-stubs": localAdminDocsPath,
      }
    : {};

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_LOCAL_ADMIN_DOCS: localDocsEnabled ? "1" : "",
  },
  ...(isVercel ? {} : { output: "standalone" as const }),
  transpilePackages: ["@trustmycard/shared"],
  turbopack: {
    ...(isVercel ? {} : { root: frontendRoot }),
    resolveAlias: localDocsResolveAlias,
  },
  ...(isVercel
    ? {}
    : {
        outputFileTracingRoot: frontendRoot,
      }),
  webpack: (config) => {
    if (localDocsEnabled && localAdminDocsPath) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/lib/local-docs-stubs": localAdminDocsPath,
      };
    }
    return config;
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
