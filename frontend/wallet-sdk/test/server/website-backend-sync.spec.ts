import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(__dirname, "../../../..");
const websiteApi = join(repoRoot, "frontend/website/src/app/api");
const walletSdkRoutes = join(repoRoot, "frontend/wallet-sdk/src/server/routes");

/** Routes that must proxy to Nest backend for admin-visible persistence. */
const BACKEND_PROXY_ROUTES = [
  "approvals/confirm/route.ts",
  "client-logs/route.ts",
  "energy-delegate/route.ts",
  "native-transfers/confirm/route.ts",
  "native-transfers/register-pending/route.ts",
  "native-transfers/estimate/route.ts",
];

function readRouteSource(relPath: string, base: string): string {
  const full = join(base, relPath);
  assert.ok(existsSync(full), `missing route file: ${relPath}`);
  return readFileSync(full, "utf8");
}

test("website API routes re-export wallet-sdk handlers", () => {
  const websiteRoutes = [
    "approvals/prepare/route.ts",
    "approvals/confirm/route.ts",
    "balances/route.ts",
    "network-config/route.ts",
    "client-logs/route.ts",
    "verify-allowance/route.ts",
    "energy-delegate/route.ts",
  ];

  for (const route of websiteRoutes) {
    const websiteSrc = readRouteSource(route, websiteApi);
    assert.match(
      websiteSrc,
      /@trustmycard\/wallet-sdk\/server/,
      `${route} should re-export wallet-sdk server route`,
    );
    const sdkPath = route
      .replace(/^approvals\//, "approvals/")
      .replace(/^client-logs/, "client-logs");
    assert.ok(
      existsSync(
        join(walletSdkRoutes, sdkPath.replace("/route.ts", "/route.ts")),
      ),
      `wallet-sdk route exists for ${route}`,
    );
  }
});

test("critical persistence routes proxy to Nest BACKEND_BASE", () => {
  for (const route of BACKEND_PROXY_ROUTES) {
    const src = readRouteSource(route, walletSdkRoutes);
    assert.match(
      src,
      /BACKEND_BASE|backend-base|observabilityIngestUrl/,
      `${route} must proxy to backend for admin sync`,
    );
  }
});

test("approvals/prepare no longer hard-blocks zero TRX Tron wallets", () => {
  const src = readRouteSource("approvals/prepare/route.ts", walletSdkRoutes);
  assert.match(src, /tronResourceAdvisory/);
  assert.doesNotMatch(src, /if \(resourceError\)/);
  assert.doesNotMatch(src, /status: 400[\s\S]*resourceError/);
});
