import type { TestSuiteMeta } from "@/components/DeveloperTestPanel";
import { MIGRATION_TEST_STEP_IDS } from "@/lib/documentation/domain-migration-test-config";

export const DOMAIN_MIGRATION_SUITE_ID = "domain-migration-verification";

export const domainMigrationSuiteMeta: TestSuiteMeta = {
  id: DOMAIN_MIGRATION_SUITE_ID,
  packageId: "infrastructure",
  packageName: "infrastructure",
  packageDisplayName: "Infrastructure",
  file: "lib/migration-test/runner.ts",
  fileName: "domain-migration",
  friendlyTitle: "Domain migration verification",
  area: "infrastructure",
  areaLabel: "Infrastructure",
  layer: "integration",
  layerLabel: "Integration",
  inDefaultScript: true,
  isFeatured: false,
  isEndToEnd: true,
  journeyStart: "Old domain (legacy)",
  journeyEnd: "New domain (production)",
  description:
    "Automated HTTPS redirects, marketing session, API, and CORS checks when migrating production domains.",
  purpose:
    "Verifies the old domain no longer serves the product, and the new domain serves decoy, gated /connect, marketing flows, and API correctly.",
  expectedResult:
    "All automated Phase A + B checks pass (B8 WalletConnect UI and B11 Render SSL are manual).",
  why: "Catches DNS, env var, CORS, and marketing gating mistakes before switching ad traffic.",
  cases: MIGRATION_TEST_STEP_IDS.map((id) => ({
    name: id,
    friendlyName: id.toUpperCase(),
    kind: "test" as const,
  })),
  caseCount: MIGRATION_TEST_STEP_IDS.length,
};
