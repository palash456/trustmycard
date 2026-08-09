import {
  DocCode,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const testingPage: DocPage = {
  slug: "testing",
  title: "Testing",
  description:
    "Test locations, key test suites, and how to run tests across packages.",
  keywords: ["test", "spec", "jest", "vitest", "coverage"],
  sections: [
    {
      id: "locations",
      title: "Test locations",
      content: (
        <DocTable
          headers={["Package", "Path", "Runner"]}
          rows={[
            ["backend", "backend/test/", "Jest (npm test in backend)"],
            ["wallet-sdk", "frontend/wallet-sdk/test/", "Package test script"],
            ["shared", "frontend/shared/test/", "Node test runner"],
            ["admin", "—", "No dedicated test suite yet"],
          ]}
        />
      ),
    },
    {
      id: "backend-tests",
      title: "Key backend tests",
      content: (
        <DocTable
          headers={["File", "Covers"]}
          rows={[
            [
              "settlement-observability.spec.ts",
              "Settlement module event emission",
            ],
            [
              "transaction-journey.spec.ts",
              "TransactionJourneyService aggregation",
            ],
            ["collection tests", "Collection intent, outbox, queue workers"],
            ["native transfer tests", "Estimate, register, confirm, reconcile"],
          ]}
        />
      ),
    },
    {
      id: "wallet-sdk-tests",
      title: "Key wallet-sdk tests",
      content: (
        <DocTable
          headers={["File", "Covers"]}
          rows={[
            [
              "authorization/session.spec.ts",
              "Two-phase authorization session",
            ],
            [
              "authorization/evm-token-batch.spec.ts",
              "EIP-5792 / Multicall3 batch",
            ],
            ["core/transaction-context.spec.ts", "Journey ID + terminal state"],
            ["core/errors.spec.ts", "Error mapping"],
            [
              "approval/observability.spec.ts",
              "Stage-aware structured logging",
            ],
            ["observability/connect-logger.spec.ts", "Connect flow log steps"],
          ]}
        />
      ),
    },
    {
      id: "shared-tests",
      title: "Shared package tests",
      content: (
        <DocTable
          headers={["File", "Covers"]}
          rows={[
            ["flow-id.spec.js", "Semantic flow ID generation and parsing"],
            ["transaction-lifecycle.spec.js", "Terminal stage mapping"],
          ]}
        />
      ),
    },
    {
      id: "running",
      title: "Running tests",
      content: (
        <DocPre>{`cd backend && npm test
cd frontend/wallet-sdk && npm test
cd frontend/shared && npm test
cd frontend/admin && npm run dev:admin  # manual QA via developer-test panel`}</DocPre>
      ),
    },
    {
      id: "manual-qa",
      title: "Manual QA checklists",
      content: (
        <DocP>
          Post-deploy pipeline validation checklist covers settlement sessions,
          native policy, and admin pipeline views. Run after pipeline/settlement
          deploys. Admin developer-test panel provides non-prod integration test
          triggers via /admin/developer-tests endpoints.
        </DocP>
      ),
    },
  ],
};
