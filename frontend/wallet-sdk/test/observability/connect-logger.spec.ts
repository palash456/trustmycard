import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveConnectStepLogStatus,
  type LogStatus,
} from "@trustmycard/shared/observability";
import { TRANSACTION_TERMINAL_STAGES } from "@trustmycard/shared/constants/transaction-lifecycle";
import type { LogEvent } from "@trustmycard/shared/observability";
import { createConnectLogStep } from "../../src/observability/connect-logger";
import { createLogger } from "../../src/observability/logger";

describe("connect logger traceability", () => {
  it("connect logger setup emits unified journey IDs (same contract as createConnectLogStep)", () => {
    const captured: LogEvent[] = [];
    const traceId = "flow-test-abc";
    createLogger({
      module: "connect",
      context: {
        traceId,
        transactionId: traceId,
        correlationId: traceId,
        sessionId: traceId,
      },
      sinks: [(event) => captured.push(event)],
      devMode: false,
    })
      .child({
        walletAddress: "0xabc",
        network: "eth",
        sessionId: traceId,
        transactionId: traceId,
      })
      .emit({
        level: "info",
        operation: "scan_started",
        stage: "SCAN STARTED",
        status: "in_progress",
        message: "QR scan started",
      });

    assert.equal(captured.length, 1);
    const event = captured[0]!;
    assert.equal(event.sessionId, traceId);
    assert.equal(event.traceId, traceId);
    assert.equal(event.correlationId, traceId);
    assert.equal(event.walletAddress, "0xabc");
  });

  it("createConnectLogStep runs without conflating wallet address into sessionId", () => {
    const step = createConnectLogStep("flow-unique-1");
    assert.doesNotThrow(() =>
      step("WALLET CONNECTED", { walletAddress: "0x123", network: "pol" }),
    );
  });

  it("marks completed connect milestones as success", () => {
    assert.equal(resolveConnectStepLogStatus("SCAN STARTED"), "success");
    assert.equal(resolveConnectStepLogStatus("WALLET CONNECTED"), "success");
    assert.equal(
      resolveConnectStepLogStatus(TRANSACTION_TERMINAL_STAGES.CANCELLED),
      "user_rejection",
    );
  });
});
