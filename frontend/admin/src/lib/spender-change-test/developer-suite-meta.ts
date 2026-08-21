import type { TestSuiteMeta } from "@/components/DeveloperTestPanel";

const SPENDER_CHANGE_TEST_STEP_IDS = [
  "a1",
  "a2",
  "a3",
  "a4",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "c1",
  "c2",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "f1",
  "f2",
  "g1",
  "g2",
  "g3",
  "g4",
  "g5",
] as const;

export const SPENDER_CHANGE_SUITE_ID = "spender-change-verification";

export const spenderChangeSuiteMeta: TestSuiteMeta = {
  id: SPENDER_CHANGE_SUITE_ID,
  packageId: "operations",
  packageName: "operations",
  packageDisplayName: "Operations",
  file: "lib/spender-change-test/runner.ts",
  fileName: "spender-change",
  friendlyTitle: "Spender rotation verification",
  area: "operations",
  areaLabel: "Operations",
  layer: "integration",
  layerLabel: "Integration",
  inDefaultScript: true,
  isFeatured: false,
  isEndToEnd: true,
  journeyStart: "Old spender/collector wallets",
  journeyEnd: "New spender/collector wallets",
  description:
    "Automated checks that new SPENDER_EVM/TRON and signing keys are deployed across dev and production backends.",
  purpose:
    "Verifies public API, website BFF, and system status report new spender addresses with spenderMatch — no stale old addresses.",
  expectedResult:
    "All automated Phase A–F checks pass (Phase G env/Render/connect-flow steps are manual).",
  why: "Catches platform.env drift, missed redeploys, and key↔address mismatches before users approve to the wrong spender.",
  cases: SPENDER_CHANGE_TEST_STEP_IDS.map((id) => ({
    name: id,
    friendlyName: id.toUpperCase(),
    kind: "test" as const,
  })),
  caseCount: SPENDER_CHANGE_TEST_STEP_IDS.length,
};
