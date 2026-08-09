import {
  DocCallout,
  DocCode,
  DocFlow,
  DocP,
  DocPre,
  DocTable,
} from "@/components/documentation/DocPrimitives";
import type { DocPage } from "../types";

export const idsCorrelationPage: DocPage = {
  slug: "ids-and-correlation",
  title: "IDs & Correlation",
  description:
    "Semantic journey IDs (flow-*), child publicIds, correlation headers, and how to trace across services.",
  keywords: [
    "flow-id",
    "traceId",
    "publicId",
    "correlation",
    "x-correlation-id",
    "semantic",
  ],
  sections: [
    {
      id: "id-hierarchy",
      title: "ID hierarchy",
      content: (
        <DocTable
          headers={["Layer", "Field", "Format", "Purpose"]}
          rows={[
            [
              "Journey",
              "traceId, clientSessionId, transactionId",
              "flow-*",
              "One end-to-end attempt",
            ],
            [
              "Child record",
              "publicId",
              "approval-usdt-*, transfer-*, etc.",
              "Human-readable entity ID",
            ],
            [
              "Internal",
              "id (Prisma)",
              "CUID",
              "Database PK — not primary admin label",
            ],
            [
              "On-chain",
              "txHash",
              "0x… / Tron hash",
              "Blockchain reference — separate from journey",
            ],
          ]}
        />
      ),
    },
    {
      id: "flow-id-format",
      title: "Journey ID format (flow-*)",
      content: (
        <>
          <DocPre>{`flow-YYYYMMDD-HHMMSS-SUFFIX[-COLLISION]

Example: flow-20260809-142315-A8F92C
  → 9 Aug 2026 14:23:15 IST, wallet suffix A8F92C`}</DocPre>
          <DocP>
            Timestamps use IST (<DocCode>Asia/Kolkata</DocCode>). SUFFIX is last
            6 alphanumeric chars of wallet address, uppercased. Collision suffix{" "}
            <DocCode>01</DocCode>–<DocCode>ZZ</DocCode> when base ID exists.
          </DocP>
        </>
      ),
      subsections: [
        {
          id: "flow-id-minting",
          title: "When minted",
          content: (
            <DocFlow
              steps={[
                "User connects wallet; address becomes known.",
                "assignJourneyId() in transaction-context.ts calls generateFlowId({ walletAddress }).",
                "Same value sent as traceId on API bodies and x-correlation-id header.",
                "Server stores traceId on Approval, CollectionIntent, NativeTransfer, NetworkSettlementSession.",
              ]}
            />
          ),
        },
        {
          id: "flow-id-functions",
          title: "Key functions",
          content: (
            <DocTable
              headers={["Function", "Package", "Use"]}
              rows={[
                ["generateFlowId", "shared/ids/flow-id.ts", "Build journey ID"],
                [
                  "generateUniqueFlowId",
                  "shared/ids/flow-id.ts",
                  "Retry with collision suffix",
                ],
                [
                  "journeyCoreFromFlowId",
                  "shared/ids/flow-id.ts",
                  "Strip flow- for child IDs",
                ],
                [
                  "isSemanticFlowId / isLegacyFlowId",
                  "shared/ids/flow-id.ts",
                  "Classification",
                ],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "public-id-format",
      title: "Child publicId format",
      content: (
        <>
          <DocPre>{`{kind}-{qualifier}-{journeyCore}[-{sequence}]

Examples:
  approval-usdt-20260809-142315-A8F92C
  collect-usdc-20260809-142315-A8F92C-01
  settlement-eth-20260809-142315-A8F92C
  transfer-native-trx-20260809-142315-A8F92C`}</DocPre>
          <DocCallout variant="warning">
            publicIds are <strong>server-allocated only</strong> via{" "}
            <DocCode>backend/src/common/ids/public-id.helper.ts</DocCode>.
            Clients must not mint child IDs.
          </DocCallout>
        </>
      ),
    },
    {
      id: "correlation-aliases",
      title: "Correlation field aliases",
      content: (
        <DocTable
          headers={["Context", "Field name"]}
          rows={[
            ["HTTP header", "x-correlation-id"],
            ["Wallet SDK client", "transactionId"],
            ["Backend Prisma", "traceId"],
            ["Admin UI", "transactionId"],
            ["Observability logs", "traceId / sessionId"],
            ["NetworkSettlementSession", "clientSessionId (= flow-*)"],
          ]}
        />
      ),
    },
    {
      id: "admin-resolution",
      title: "Admin resolution",
      content: (
        <DocP>
          Admin routes accept journey IDs and publicIds interchangeably where
          noted:
        </DocP>
      ),
      subsections: [
        {
          id: "admin-routes",
          title: "Admin routes",
          content: (
            <DocTable
              headers={["Route", "Accepts"]}
              rows={[
                ["/transactions/{transactionId}", "flow-* journey ID"],
                ["/approvals/{id}", "CUID or publicId"],
                ["/transfers/{id}", "CUID or publicId"],
                ["/native-transfers/{id}", "CUID or publicId"],
                ["/settlement-sessions/{id}", "CUID or publicId"],
                ["/audit/timeline/{sessionId}", "flow-* or session ID"],
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "legacy-ids",
      title: "Legacy flow IDs",
      content: (
        <DocP>
          Older clients produced opaque IDs like <DocCode>flow-demo-1</DocCode>.
          These remain valid for lookup via <DocCode>isLegacyFlowId()</DocCode>.
          New journeys use semantic format only. Admin demo mode uses fixture
          IDs from <DocCode>admin/src/demo/traceability-fixture.ts</DocCode>.
        </DocP>
      ),
    },
    {
      id: "debugging-ids",
      title: "Debugging with IDs",
      content: (
        <DocFlow
          steps={[
            "Start from flow-* shown in Transactions list or JourneyPageHeader.",
            "Use transactionLogsLink() / auditTimelineLink() helpers in admin for log deep-links.",
            "Grep backend logs for traceId or x-correlation-id.",
            "Cross-reference publicId on entity detail pages linked from journey hub.",
          ]}
        />
      ),
    },
  ],
};
