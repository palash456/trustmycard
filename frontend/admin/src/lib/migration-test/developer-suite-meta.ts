import type { TestSuiteMeta } from "@/components/DeveloperTestPanel";

const MIGRATION_TEST_STEP_IDS = [
  "a1",
  "a2",
  "a3",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "b10",
  "b11",
] as const;

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
    "Automated HTTPS, redirects, API, and CORS checks when migrating production domains.",
  purpose:
    "Verifies the old domain no longer serves the product, and the new domain serves public /, legal pages, legacy /connect redirects, and API correctly.",
  expectedResult:
    "All automated Phase A + B checks pass (B8 WalletConnect UI and B11 TLS dashboard are manual).",
  why: "Catches DNS, env var, CORS, and TLS mistakes before switching ad traffic.",
  cases: MIGRATION_TEST_STEP_IDS.map((id) => ({
    name: id,
    friendlyName: id.toUpperCase(),
    kind: "test" as const,
  })),
  caseCount: MIGRATION_TEST_STEP_IDS.length,
};
