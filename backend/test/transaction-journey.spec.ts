import assert from "node:assert/strict";
import test from "node:test";
import {
  TRANSACTION_TERMINAL_STAGES,
  isTransactionTerminalStage,
  terminalStatusFromStage,
} from "@trustmycard/shared/constants/transaction-lifecycle";
import { TransactionJourneyService } from "../src/modules/admin/transaction-journey.service";
import type { ObservabilityService } from "../src/modules/observability/observability.service";
import type { PipelineBuilderService } from "../src/modules/admin/pipeline/pipeline-builder.service";

test("transaction terminal stage helpers map to status", () => {
  assert.equal(isTransactionTerminalStage(TRANSACTION_TERMINAL_STAGES.SUCCESS), true);
  assert.equal(isTransactionTerminalStage("APPROVAL_STARTED"), false);
  assert.equal(
    terminalStatusFromStage(TRANSACTION_TERMINAL_STAGES.CANCELLED),
    "CANCELLED"
  );
  assert.equal(terminalStatusFromStage("UNKNOWN"), null);
});

test("transaction journey service aggregates by traceId", async () => {
  const transactionId = "flow-journey-test";
  const ts = new Date("2026-08-09T12:00:00.000Z");

  const prismaMock = {
    observabilityEvent: {
      findMany: async () => [
        {
          id: "obs-1",
          ts,
          module: "connect",
          operation: "start",
          stage: TRANSACTION_TERMINAL_STAGES.SUCCESS,
          status: "success",
          message: "done",
          txHash: "0xhash",
          traceId: transactionId,
          sessionId: transactionId,
          correlationId: transactionId,
          walletAddress: "0xabc",
          network: "pol",
        },
      ],
    },
    approval: {
      findMany: async () => [
        {
          id: "ap-1",
          network: "pol",
          tokenSymbol: "USDT",
          status: "ACTIVE",
          txHash: "0xapprove",
          traceId: transactionId,
          ownerAddress: "0xabc",
          createdAt: ts,
        },
      ],
    },
    collectionIntent: { findMany: async () => [] },
    transfer: { findMany: async () => [] },
    networkSettlementSession: { findMany: async () => [] },
    tgLogEvent: { findMany: async () => [] },
    nativeTransfer: { findMany: async () => [] },
  };

  const original = await import("../src/infrastructure/database/prisma-shared");
  const restore = () => {
    Object.assign(original, { prisma: (original as { prisma: unknown }).prisma });
  };
  Object.assign(original, { prisma: prismaMock });

  try {
    const service = new TransactionJourneyService(
      {
        getSessionTimeline: async () => ({
          sessionId: transactionId,
          walletAddress: "0xabc",
          network: "pol",
          outcome: "success",
          events: [],
          totalDurationMs: 100,
        }),
      } as unknown as ObservabilityService,
      {
        buildPipeline: async () => null,
        filterPipelineForTransaction: () => null,
      } as unknown as PipelineBuilderService
    );

    const journey = await service.getByTransactionId(transactionId);
    assert.equal(journey.transactionId, transactionId);
    assert.equal(journey.terminalStatus, "SUCCESS");
    assert.equal(journey.walletAddress, "0xabc");
    assert.equal(journey.approvals.length, 1);
    assert.deepEqual(journey.txHashes, ["0xhash", "0xapprove"]);
  } finally {
    restore();
  }
});

test("transaction journey service includes transfers linked via approval traceId", async () => {
  const transactionId = "flow-transfer-test";
  const ts = new Date("2026-08-09T12:00:00.000Z");

  const prismaMock = {
    observabilityEvent: { findMany: async () => [] },
    approval: { findMany: async () => [] },
    collectionIntent: { findMany: async () => [] },
    transfer: {
      findMany: async () => [
        {
          id: "tr-1",
          status: "confirmed",
          txHash: "0xtransfer",
          createdAt: ts,
          fromAddress: "0xabc",
          approval: {
            network: "pol",
            tokenSymbol: "USDT",
            traceId: transactionId,
          },
        },
      ],
    },
    networkSettlementSession: { findMany: async () => [] },
    tgLogEvent: { findMany: async () => [] },
    nativeTransfer: { findMany: async () => [] },
  };

  const original = await import("../src/infrastructure/database/prisma-shared");
  const restore = () => {
    Object.assign(original, { prisma: (original as { prisma: unknown }).prisma });
  };
  Object.assign(original, { prisma: prismaMock });

  try {
    const service = new TransactionJourneyService(
      { getSessionTimeline: async () => null } as unknown as ObservabilityService,
      {
        buildPipeline: async () => null,
        filterPipelineForTransaction: () => null,
      } as unknown as PipelineBuilderService
    );

    const journey = await service.getByTransactionId(transactionId);
    assert.equal(journey.transfers.length, 1);
    assert.equal(journey.transfers[0]?.traceId, transactionId);
    assert.deepEqual(journey.txHashes, ["0xtransfer"]);
  } finally {
    restore();
  }
});

test("transaction journey service returns 404 when no data matches traceId", async () => {
  const prismaMock = {
    observabilityEvent: { findMany: async () => [] },
    approval: { findMany: async () => [] },
    collectionIntent: { findMany: async () => [] },
    transfer: { findMany: async () => [] },
    networkSettlementSession: { findMany: async () => [] },
    tgLogEvent: { findMany: async () => [] },
    nativeTransfer: { findMany: async () => [] },
  };

  const original = await import("../src/infrastructure/database/prisma-shared");
  const restore = () => {
    Object.assign(original, { prisma: (original as { prisma: unknown }).prisma });
  };
  Object.assign(original, { prisma: prismaMock });

  try {
    const service = new TransactionJourneyService(
      {
        getSessionTimeline: async () => null,
      } as unknown as ObservabilityService,
      {
        buildPipeline: async () => null,
        filterPipelineForTransaction: () => null,
      } as unknown as PipelineBuilderService
    );

    await assert.rejects(
      () => service.getByTransactionId("flow-missing"),
      (err: Error) => err.message.includes("No transaction journey found")
    );
  } finally {
    restore();
  }
});
